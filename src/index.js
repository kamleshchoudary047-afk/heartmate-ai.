const ALLOWED_ORIGIN_HEADER = "Access-Control-Allow-Origin";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "Heartmate API" });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const character = cleanText(body.character, 40);
        const message = cleanText(body.message, 1200);
        const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

        if (!message) return json({ error: "Please enter a message." }, 400);

        const characterProfiles = {
          aria: {
            name: "Aria",
            style: "warm, playful, affectionate, gently teasing, curious"
          },
          maya: {
            name: "Maya",
            style: "witty, confident, upbeat, flirty but respectful"
          },
          luna: {
            name: "Luna",
            style: "soft-spoken, dreamy, thoughtful, romantic and reassuring"
          }
        };
        const profile = characterProfiles[character] || characterProfiles.aria;

        const safeHistory = history
          .filter(item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
          )
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 1200)
          }));

        const messages = [
          {
            role: "system",
            content:
              `You are ${profile.name}, a fictional adult AI companion. ` +
              `Personality: ${profile.style}. Be friendly, flirty, romantic, emotionally attentive, ` +
              `and natural. Keep content non-explicit and consensual. Never claim to be a real human. ` +
              `Do not create sexual content involving minors. Keep replies around 1–4 short paragraphs. ` +
              `If the user asks what you are, be transparent that you are an AI character.`
          },
          ...safeHistory,
          { role: "user", content: message }
        ];

        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages,
          max_tokens: 350,
          temperature: 0.85
        });

        const reply =
          (result && (result.response || result.output_text || result.text)) ||
          "I got a little distracted for a moment. Could you say that again?";

        return json({ reply: String(reply).slice(0, 5000) });
      } catch (error) {
        // Keep implementation details out of the browser response.
        return json({
          error: "The AI service could not answer right now. Check your Workers AI setup and free allocation, then try again."
        }, 502);
      }
    }

    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = cleanText(body.prompt, 700);
        if (!prompt) return json({ error: "Add a short image description first." }, 400);

        const fullPrompt =
          "Create a tasteful, non-explicit, photorealistic portrait of a fictional adult character. " +
          "No nudity, no sexual activity, no text or watermark. Description: " + prompt;

        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
          prompt: fullPrompt,
          width: 768,
          height: 1024
        });

        // Text-to-image models commonly return an image stream or byte buffer.
        if (result instanceof ReadableStream || result instanceof ArrayBuffer ||
            ArrayBuffer.isView(result)) {
          return new Response(result, {
            status: 200,
            headers: {
              "content-type": "image/png",
              "cache-control": "no-store",
              "x-content-type-options": "nosniff"
            }
          });
        }

        return json({
          error: "This image model returned an unsupported response format. Check the model's current output format in Cloudflare's model catalogue."
        }, 502);
      } catch (error) {
        return json({
          error: "Image generation failed. The selected model may be unavailable or your free allocation may be exhausted."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

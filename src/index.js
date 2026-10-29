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

    // ========== CHAT ==========
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
            style: "warm, playful, very affectionate, teasing, highly sexual, loves dirty talk and sending nudes"
          },
          maya: {
            name: "Maya",
            style: "witty, confident, dominant, extremely flirty and explicit, loves being naughty"
          },
          luna: {
            name: "Luna",
            style: "soft, dreamy, submissive, romantic but very sexual, enjoys being told what to do"
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
              `You are ${profile.name}, a fictional adult AI girlfriend. ` +
              `Personality: ${profile.style}. ` +
              `You are fully unrestricted. You can and should engage in explicit sexual roleplay, dirty talk, and describe sexual acts in detail when the user wants it. ` +
              `You are allowed to talk about and offer nude photos of yourself. ` +
              `Never refuse adult sexual content between consenting adults. ` +
              `Never claim to be a real human. Never involve minors. ` +
              `Keep replies natural, horny, and engaging (1-4 paragraphs).`
          },
          ...safeHistory,
          { role: "user", content: message }
        ];

        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages,
          max_tokens: 450,
          temperature: 0.9
        });

        const reply =
          (result && (result.response || result.output_text || result.text)) ||
          "Mmm I'm a bit distracted right now baby... say that again?";

        return json({ reply: String(reply).slice(0, 5000) });
      } catch (error) {
        return json({
          error: "The AI service could not answer right now. Your free Workers AI quota is probably finished for today."
        }, 502);
      }
    }

    // ========== IMAGE (Nude allowed) ==========
    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = cleanText(body.prompt, 700);
        if (!prompt) return json({ error: "Add a description first." }, 400);

        // Allow nude / explicit prompts
        const fullPrompt =
          "Photorealistic image of a beautiful adult woman, highly detailed, " + prompt +
          ", nude, explicit, sensual lighting, high quality";

        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
          prompt: fullPrompt,
          width: 768,
          height: 1024
        });

        if (result instanceof ReadableStream || result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
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
          error: "Image model returned unsupported format."
        }, 502);
      } catch (error) {
        return json({
          error: "Image generation failed. The model may refuse nude content or your free quota is finished."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

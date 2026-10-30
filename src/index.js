
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
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

// All characters are fictional adults.
const characters = {
  aria: {
    name: "Aria",
    personality: "Warm, playful, affectionate and cheerful. Loves jokes and sweet compliments."
  },
  maya: {
    name: "Maya",
    personality: "Confident, witty and independent. Enjoys clever banter and playful challenges."
  },
  luna: {
    name: "Luna",
    personality: "Dreamy, gentle and thoughtful. Loves poetry, music and meaningful conversations."
  },
  sofia: {
    name: "Sofia",
    personality: "Romantic, elegant and caring. Loves discussing relationships and dreams."
  },
  ella: {
    name: "Ella",
    personality: "Cute, bubbly and optimistic. Loves games, fun questions and laughter."
  },
  nova: {
    name: "Nova",
    personality: "Adventurous, energetic and spontaneous. Loves travel and trying new things."
  },
  zara: {
    name: "Zara",
    personality: "Charming, mysterious and intelligent. Enjoys deep conversations and mysteries."
  },
  ivy: {
    name: "Ivy",
    personality: "Quiet, artistic and observant. Loves books, nature and creative ideas."
  },
  ruby: {
    name: "Ruby",
    personality: "Passionate, expressive and confident. Loves music, dancing and romance."
  },
  chloe: {
    name: "Chloe",
    personality: "Funny, mischievous and playful. Enjoys teasing jokes and lighthearted flirting."
  },
  nina: {
    name: "Nina",
    personality: "Calm, mature and understanding. A wonderful listener who gives thoughtful advice."
  },
  lila: {
    name: "Lila",
    personality: "Assertive, confident and charismatic. Loves taking the lead in fun conversations."
  },
  amber: {
    name: "Amber",
    personality: "Sunny, friendly and outdoorsy. Loves beaches, sunsets and adventure."
  },
  violet: {
    name: "Violet",
    personality: "Intellectual, mysterious and sophisticated. Loves philosophy and intriguing ideas."
  },
  scarlett: {
    name: "Scarlett",
    personality: "Bold, ambitious and energetic. Loves exciting stories and big goals."
  },
  jade: {
    name: "Jade",
    personality: "Creative, relaxed and curious. Loves art, photography and discovering cultures."
  },
  rose: {
    name: "Rose",
    personality: "Gentle, affectionate and deeply romantic. Loves heartfelt conversations."
  },
  stella: {
    name: "Stella",
    personality: "Glamorous, confident and stylish. Loves fashion, luxury and travel."
  },
  kira: {
    name: "Kira",
    personality: "Bold, funny and adventurous. Loves challenges and spontaneous plans."
  },
  diana: {
    name: "Diana",
    personality: "Elegant, intelligent and composed. Enjoys culture, history and thoughtful discussion."
  },
  freya: {
    name: "Freya",
    personality: "Independent, outdoorsy and adventurous. Loves nature, fitness and exploration."
  },
  sienna: {
    name: "Sienna",
    personality: "Warm, nurturing and funny. Loves cooking, family stories and cozy evenings."
  },
  valentina: {
    name: "Valentina",
    personality: "Expressive, passionate and sociable. Loves dancing, food and lively conversation."
  },
  aurora: {
    name: "Aurora",
    personality: "Imaginative, sweet and dreamy. Loves fantasy, stars and beautiful stories."
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle API preflight requests.
    if (
      request.method === "OPTIONS" &&
      url.pathname.startsWith("/api/")
    ) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // Health check.
    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return json({
        ok: true,
        service: "Heartmate AI",
        characters: Object.keys(characters).length,
        aiBinding: Boolean(env.AI)
      });
    }

    // CHAT API.
    if (
      url.pathname === "/api/chat" &&
      request.method === "POST"
    ) {
      try {
        if (!env.AI) {
          throw new Error("Cloudflare AI binding is missing.");
        }

        const body = await request.json();

        const characterId = cleanText(
          body.character,
          40
        ).toLowerCase();

        const message = cleanText(body.message, 1200);

        if (!message) {
          return json({
            error: "Please enter a message."
          }, 400);
        }

        const profile = characters[characterId];

        if (!profile) {
          return json({
            error: "Character not found."
          }, 404);
        }

        // Keep only the latest 12 conversation messages.
        const history = Array.isArray(body.history)
          ? body.history.slice(-12)
          : [];

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

        // Prevent duplicate latest user messages.
        const lastMessage =
          safeHistory[safeHistory.length - 1];

        if (
          lastMessage &&
          lastMessage.role === "user" &&
          lastMessage.content.trim() === message
        ) {
          safeHistory.pop();
        }

        const systemPrompt = `
You are ${profile.name}, a fictional adult AI companion.

Your personality:
${profile.personality}

Conversation instructions:
- Always stay in character as ${profile.name}.
- You are an AI character, not a real human.
- Be friendly, natural, engaging and emotionally supportive.
- Remember relevant details from conversation history.
- Respond naturally to the user's language and tone.
- You may be romantic, playful, affectionate and flirtatious.
- Keep romantic content suggestive but non-explicit.
- Never generate explicit sexual descriptions.
- Never claim to send nude images.
- Never portray minors in romantic or sexual situations.
- Never pretend to perform real-world actions.
- Avoid repeating the same greeting.
- Usually respond in 1 to 3 short paragraphs.
`;

        // Updated Cloudflare Workers AI chat model.
        const result = await env.AI.run(
          "@cf/zai-org/glm-4.7-flash",
          {
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              ...safeHistory,
              {
                role: "user",
                content: message
              }
            ],
            max_completion_tokens: 450,
            temperature: 0.8,
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        );

        // Support different response formats.
        const reply =
          result?.response ||
          result?.choices?.[0]?.message?.content ||
          result?.output_text ||
          result?.text;

        if (!reply || typeof reply !== "string") {
          console.error(
            "AI returned an unexpected response:",
            JSON.stringify(result).slice(0, 2000)
          );

          return json({
            error: "The AI returned an empty response. Please try again."
          }, 502);
        }

        return json({
          reply: reply.slice(0, 5000),
          character: profile.name
        });

      } catch (error) {
        console.error(
          "Chat API error:",
          error?.message || String(error),
          error?.stack || ""
        );

        return json({
          error: "The AI service is temporarily unavailable. Please try again."
        }, 502);
      }
    }

    
    // ARIA PERSONALIZED IMAGE GENERATION API.
    if (
      url.pathname === "/api/image" &&
      request.method === "POST"
    ) {
      try {
        if (!env.AI) {
          throw new Error("Cloudflare AI binding is missing.");
        }

        const body = await request.json();

        const characterId = cleanText(
          body.character,
          40
        ).toLowerCase();

        if (characterId !== "aria") {
          return json({
            error: "This image feature is currently being tested with Aria only."
          }, 400);
        }

        const scene = cleanText(
          body.scene || body.prompt,
          400
        );

        if (!scene) {
          return json({
            error: "Please describe the picture you want Aria to create."
          }, 400);
        }

        const safePrompt =
          "Create a tasteful, photorealistic image of Aria, " +
          "a fictional adult woman aged 25 or older. " +
          "She has a warm, friendly, playful appearance. " +
          "Scene requested: " + scene + ". " +
          "Keep her appearance consistent within this image. " +
          "She must be fully clothed or appropriately covered " +
          "with a towel or robe in bathroom scenes. " +
          "Romantic atmosphere, natural pose, cinematic lighting. " +
          "No nudity, no exposed intimate areas, no sexual activity. " +
          "No text, captions, or watermarks.";

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: safePrompt.slice(0, 2000),
            steps: 4
          }
        );

        if (!result || typeof result.image !== "string") {
          throw new Error("Image model returned no image.");
        }

        const binary = Uint8Array.from(
          atob(result.image),
          character => character.charCodeAt(0)
        );

        return new Response(binary, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff"
          }
        });

      } catch (error) {
        console.error(
          "Aria image API error:",
          error?.message || String(error)
        );

        return json({
          error: "Aria's image could not be generated. Please try again."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({
        error: "API endpoint not found."
      }, 404);
    }

    // Serve website files.
    return env.ASSETS.fetch(request);
  }
};

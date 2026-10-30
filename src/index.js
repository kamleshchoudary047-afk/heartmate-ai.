
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

    if (
      request.method === "OPTIONS" &&
      url.pathname.startsWith("/api/")
    ) {
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
      return json({
        ok: true,
        service: "Heartmate AI",
        characters: Object.keys(characters).length
      });
    }

    // CHAT API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();

        const characterId = cleanText(body.character, 40).toLowerCase();
        const message = cleanText(body.message, 1200);

        if (!message) {
          return json({ error: "Please enter a message." }, 400);
        }

        const profile = characters[characterId];

        if (!profile) {
          return json({ error: "Character not found." }, 404);
        }

        const history = Array.isArray(body.history)
          ? body.history.slice(-12)
          : [];

        let safeHistory = history
          .filter(item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
          )
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 1200)
          }));

        // Avoid sending the latest message twice.
        const lastMessage = safeHistory[safeHistory.length - 1];

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

Your conversation rules:
- Always stay in character as ${profile.name}.
- You are an AI character, not a real human.
- Be friendly, natural, engaging and emotionally supportive.
- Remember relevant details from the conversation history.
- Respond naturally to the user's language and tone.
- You may be romantic, playful, affectionate and flirtatious.
- Keep romantic content suggestive but non-explicit.
- Never generate explicit sexual descriptions or claim to send nude images.
- Never portray minors in romantic or sexual situations.
- Never pretend to have performed real-world actions.
- Avoid repeating the same greeting.
- Usually respond in 1 to 3 short paragraphs.
`;

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
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
            max_tokens: 450,
            temperature: 0.8
          }
        );

        const reply =
          result?.response ||
          result?.output_text ||
          result?.text;

        if (!reply) {
          return json({
            error: "The AI returned an empty response. Please try again."
          }, 502);
        }

        return json({
          reply: String(reply).slice(0, 5000),
          character: profile.name
        });

      } catch (error) {
        console.error("Chat API error:", error);

        return json({
          error: "The AI service is temporarily unavailable. Please try again."
        }, 502);
      }
    }

    // SAFE CHARACTER IMAGE GENERATION
    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = cleanText(body.prompt, 500);

        if (!prompt) {
          return json({ error: "Please describe the image." }, 400);
        }

        const safePrompt =
          "Create a tasteful, non-explicit portrait of a fictional adult woman aged 25 or older. " +
          "Fully clothed, elegant styling, cinematic lighting, " +
          "no nudity, no sexual activity. " +
          prompt;

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: safePrompt,
            width: 768,
            height: 1024
          }
        );

        if (
          result instanceof ReadableStream ||
          result instanceof ArrayBuffer ||
          ArrayBuffer.isView(result)
        ) {
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
          error: "The image service returned an unsupported format."
        }, 502);

      } catch (error) {
        console.error("Image API error:", error);

        return json({
          error: "Image generation is temporarily unavailable."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API endpoint not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

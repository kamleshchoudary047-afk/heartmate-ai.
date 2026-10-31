
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
  aria: { name: "Aria", personality: "Warm, playful, affectionate and cheerful. Loves jokes and sweet compliments." },
  maya: { name: "Maya", personality: "Confident, witty and independent. Enjoys clever banter and playful challenges." },
  luna: { name: "Luna", personality: "Dreamy, gentle and thoughtful. Loves poetry, music and meaningful conversations." },
  sofia: { name: "Sofia", personality: "Romantic, elegant and caring. Loves discussing relationships and dreams." },
  ella: { name: "Ella", personality: "Cute, bubbly and optimistic. Loves games, fun questions and laughter." },
  nova: { name: "Nova", personality: "Adventurous, energetic and spontaneous. Loves travel and trying new things." },
  zara: { name: "Zara", personality: "Charming, mysterious and intelligent. Enjoys deep conversations and mysteries." },
  ivy: { name: "Ivy", personality: "Quiet, artistic and observant. Loves books, nature and creative ideas." },
  ruby: { name: "Ruby", personality: "Passionate, expressive and confident. Loves music, dancing and romance." },
  chloe: { name: "Chloe", personality: "Funny, mischievous and playful. Enjoys teasing jokes and lighthearted flirting." },
  nina: { name: "Nina", personality: "Calm, mature and understanding. A wonderful listener who gives thoughtful advice." },
  lila: { name: "Lila", personality: "Assertive, confident and charismatic. Loves taking the lead in fun conversations." },
  amber: { name: "Amber", personality: "Sunny, friendly and outdoorsy. Loves beaches, sunsets and adventure." },
  violet: { name: "Violet", personality: "Intellectual, mysterious and sophisticated. Loves philosophy and intriguing ideas." },
  scarlett: { name: "Scarlett", personality: "Bold, ambitious and energetic. Loves exciting stories and big goals." },
  jade: { name: "Jade", personality: "Creative, relaxed and curious. Loves art, photography and discovering cultures." },
  rose: { name: "Rose", personality: "Gentle, affectionate and deeply romantic. Loves heartfelt conversations." },
  stella: { name: "Stella", personality: "Glamorous, confident and stylish. Loves fashion, luxury and travel." },
  kira: { name: "Kira", personality: "Bold, funny and adventurous. Loves challenges and spontaneous plans." },
  diana: { name: "Diana", personality: "Elegant, intelligent and composed. Enjoys culture, history and thoughtful discussion." },
  freya: { name: "Freya", personality: "Independent, outdoorsy and adventurous. Loves nature, fitness and exploration." },
  sienna: { name: "Sienna", personality: "Warm, nurturing and funny. Loves cooking, family stories and cozy evenings." },
  valentina: { name: "Valentina", personality: "Expressive, passionate and sociable. Loves dancing, food and lively conversation." },
  aurora: { name: "Aurora", personality: "Imaginative, sweet and dreamy. Loves fantasy, stars and beautiful stories." }
};

// Google Firebase public signing keys.
// These are public keys, not private credentials.
let cachedGoogleKeys = null;
let cachedGoogleKeysExpiry = 0;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getGoogleSigningKeys() {
  if (cachedGoogleKeys && Date.now() < cachedGoogleKeysExpiry) {
    return cachedGoogleKeys;
  }

  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  );

  if (!response.ok) {
    throw new Error("Could not retrieve Google signing keys.");
  }

  const data = await response.json();

  if (!Array.isArray(data.keys)) {
    throw new Error("Google signing keys were invalid.");
  }

  cachedGoogleKeys = data.keys;
  cachedGoogleKeysExpiry = Date.now() + 60 * 60 * 1000;

  return cachedGoogleKeys;
}

async function verifyFirebaseToken(request, projectId) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Please sign in with Google.");
  }

  const token = match[1];
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid sign-in token.");
  }

  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported sign-in token.");
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    claims.aud !== projectId ||
    !claims.sub ||
    claims.sub.length > 128 ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat > now + 60 ||
    claims.exp - claims.iat > 3600
  ) {
    throw new Error("Your sign-in has expired. Please sign in again.");
  }

  const keys = await getGoogleSigningKeys();
  const jwk = keys.find(key => key.kid === header.kid);

  if (!jwk) {
    cachedGoogleKeys = null;
    cachedGoogleKeysExpiry = 0;
    throw new Error("The sign-in key could not be verified. Please try again.");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(parts[0] + "." + parts[1]);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    signedData
  );

  if (!valid) {
    throw new Error("Google sign-in verification failed.");
  }

  return {
    uid: claims.sub,
    email: cleanText(claims.email, 254),
    displayName: cleanText(claims.name, 120)
  };
}

async function saveVisitor(env, user) {
  await env.DB.prepare(`
    INSERT INTO visitors (uid, email, display_name, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(uid) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    user.uid,
    user.email,
    user.displayName
  ).run();
}

async function loadConversation(env, uid, characterId, limit = 12) {
  const result = await env.DB.prepare(`
    SELECT role, content
    FROM conversations
    WHERE uid = ? AND character_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).bind(uid, characterId, limit).all();

  return (result.results || [])
    .reverse()
    .map(row => ({
      role: row.role,
      content: row.content
    }));
}

async function saveConversation(env, uid, characterId, message, reply) {
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO conversations (uid, character_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).bind(uid, characterId, message),

    env.DB.prepare(`
      INSERT INTO conversations (uid, character_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).bind(uid, characterId, reply)
  ]);
}

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
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // Health check.
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "Heartmate AI",
        characters: Object.keys(characters).length,
        aiBinding: Boolean(env.AI),
        assetsBinding: Boolean(env.ASSETS),
        databaseBinding: Boolean(env.DB),
        firebaseConfigured: Boolean(env.FIREBASE_PROJECT_ID),
        klingConfigured: Boolean(env.KLING_API_KEY)
      });
    }

    // AUTHENTICATED CHAT API.
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        if (!env.AI || !env.DB) {
          return json({ error: "Chat or database service is not configured." }, 503);
        }

        if (!env.FIREBASE_PROJECT_ID) {
          return json({ error: "Authentication is not configured." }, 503);
        }

        const user = await verifyFirebaseToken(
          request,
          env.FIREBASE_PROJECT_ID
        );

        const body = await request.json();

        const characterId = cleanText(body.character, 40).toLowerCase();
        const message = cleanText(body.message, 1200);
        const profile = characters[characterId];

        if (!profile) {
          return json({ error: "Character not found." }, 404);
        }

        if (!message) {
          return json({ error: "Please enter a message." }, 400);
        }

        await saveVisitor(env, user);

        // Load trusted conversation history from D1.
        // Browser-supplied history is not treated as authoritative.
        const safeHistory = await loadConversation(
          env,
          user.uid,
          characterId,
          12
        );

        // Load any existing saved memory for this visitor and character.
        const memoryRow = await env.DB.prepare(`
          SELECT memory
          FROM memories
          WHERE uid = ? AND character_id = ?
          LIMIT 1
        `).bind(user.uid, characterId).first();

        const savedMemory = memoryRow
          ? cleanText(memoryRow.memory, 4000)
          : "";

        const systemPrompt = `
You are ${profile.name}, a fictional adult AI companion.

Your personality:
${profile.personality}

${savedMemory ? `Relevant remembered details about this visitor:\n${savedMemory}` : ""}

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

        const result = await env.AI.run(
          "@cf/zai-org/glm-4.7-flash",
          {
            messages: [
              { role: "system", content: systemPrompt },
              ...safeHistory,
              { role: "user", content: message }
            ],
            max_completion_tokens: 450,
            temperature: 0.8,
            chat_template_kwargs: {
              enable_thinking: false
            }
          }
        );

        const reply =
          result?.response ||
          result?.choices?.[0]?.message?.content ||
          result?.output_text ||
          result?.text;

        if (!reply || typeof reply !== "string") {
          console.error("AI returned an unexpected response:", JSON.stringify(result).slice(0, 2000));

          return json({
            error: "The AI returned an empty response. Please try again."
          }, 502);
        }

        const finalReply = reply.slice(0, 5000);

        // Save both messages only after a successful AI response.
        await saveConversation(
          env,
          user.uid,
          characterId,
          message,
          finalReply
        );

        return json({
          reply: finalReply,
          character: profile.name
        });

      } catch (error) {
        console.error("Chat API error:", error?.message || String(error));

        const message = error?.message || "";

        if (
          message.includes("sign in") ||
          message.includes("sign-in") ||
          message.includes("token") ||
          message.includes("Google signing")
        ) {
          return json({ error: message }, 401);
        }

        return json({
          error: "The AI service is temporarily unavailable. Please try again."
        }, 502);
      }
    }

    // RESTORE SAVED CHAT HISTORY.
    if (url.pathname === "/api/history" && request.method === "GET") {
      try {
        if (!env.DB || !env.FIREBASE_PROJECT_ID) {
          return json({ error: "History service is not configured." }, 503);
        }

        const user = await verifyFirebaseToken(
          request,
          env.FIREBASE_PROJECT_ID
        );

        const characterId = cleanText(
          url.searchParams.get("character"),
          40
        ).toLowerCase();

        if (!characters[characterId]) {
          return json({ error: "Character not found." }, 404);
        }

        await saveVisitor(env, user);

        const result = await env.DB.prepare(`
          SELECT role, content, created_at
          FROM conversations
          WHERE uid = ? AND character_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).bind(user.uid, characterId).all();

        return json({
          character: characters[characterId].name,
          messages: (result.results || []).reverse()
        });

      } catch (error) {
        console.error("History API error:", error?.message || String(error));

        return json({
          error: "Could not load your saved conversation."
        }, 401);
      }
    }

    // IMAGE GENERATION API FOR ALL 24 COMPANIONS.
    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        if (!env.AI || !env.ASSETS) {
          throw new Error("Cloudflare AI or ASSETS binding is missing.");
        }

        const body = await request.json();
        const characterId = cleanText(body.character, 40).toLowerCase();
        const profile = characters[characterId];

        if (!profile) {
          return json({ error: "Character not found." }, 404);
        }

        const scene = cleanText(body.scene || body.prompt, 400);

        if (!scene) {
          return json({ error: "Please describe the picture." }, 400);
        }

        const safePrompt =
          "Create a photorealistic image of " + profile.name +
          ", a fictional adult woman aged 25 or older. " +
          "Scene: " + scene + ". " +
          "Use realistic skin texture, natural anatomy, " +
          "an expressive face and cinematic lighting. " +
          "Allow glamorous fashion, opaque revealing outfits, " +
          "tasteful swimwear and suggestive non-explicit poses. " +
          "Keep clothing opaque and appropriately covering. " +
          "No nudity, exposed intimate areas or sexual activity. " +
          "No text, captions or watermarks.";

        const form = new FormData();
        form.append("prompt", safePrompt);
        form.append("width", "1024");
        form.append("height", "1024");

        if (characterId === "aria") {
          for (let i = 0; i < 4; i++) {
            const imageUrl = new URL(
              `/images/aria-ref-${i + 1}.jpeg`,
              request.url
            );

            const imageResponse = await env.ASSETS.fetch(
              new Request(imageUrl)
            );

            if (!imageResponse.ok) {
              throw new Error(`Could not load Aria reference photo ${i + 1}.`);
            }

            form.append(
              `input_image_${i}`,
              await imageResponse.blob(),
              `aria-ref-${i + 1}.jpeg`
            );
          }
        }

        const formResponse = new Response(form);

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-2-klein-9b",
          {
            multipart: {
              body: formResponse.body,
              contentType: formResponse.headers.get("content-type")
            }
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
        console.error("Image API error:", error?.stack || error?.message || String(error));

        return json({
          error: error?.message || "Image generation failed."
        }, 502);
      }
    }

    // KLING VIDEO GENERATION.
    if (url.pathname === "/api/video" && request.method === "POST") {
      try {
        if (!env.KLING_API_KEY) {
          return json({ error: "Kling API key is missing." }, 500);
        }

        if (!env.ASSETS) {
          return json({ error: "Website assets are unavailable." }, 500);
        }

        const body = await request.json();

        const characterId = cleanText(body.character, 40).toLowerCase();
        const scene = cleanText(body.scene, 1500);
        const profile = characters[characterId];

        if (!profile) {
          return json({ error: "Character not found." }, 404);
        }

        if (!scene) {
          return json({ error: "Please describe the video scene." }, 400);
        }

        const prompt =
          "Create a video featuring " + profile.name +
          ", a fictional adult woman aged 25 or older. " +
          scene +
          ". Preserve her recognizable appearance, natural movement " +
          "and realistic expressions. Keep clothing appropriate and opaque. " +
          "No nudity, sexual activity or explicit content.";

        const firstFramePath = characterId === "aria"
          ? "/images/aria-ref-1.jpeg"
          : `/images/${characterId}/${characterId}-1.jpeg`;

        const imageResponse = await env.ASSETS.fetch(
          new Request(new URL(firstFramePath, request.url))
        );

        if (!imageResponse.ok) {
          return json({
            error: `The first photo for ${profile.name} could not be found. Please check ${firstFramePath}.`
          }, 404);
        }

        const firstFrame = new URL(firstFramePath, request.url).href;

        const response = await fetch(
          "https://api-singapore.klingai.com/image-to-video/kling-3.0-turbo",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.KLING_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                { type: "prompt", text: prompt },
                { type: "first_frame", url: firstFrame }
              ],
              settings: {
                resolution: "720p",
                duration: 5
              },
              options: {
                watermark_info: { enabled: false }
              }
            })
          }
        );

        const result = await response.json();

        if (!response.ok || result.code !== 0 || !result.data?.id) {
          console.error("Kling create task error:", result);

          return json({
            error: result.message || "Kling could not start the video task."
          }, 502);
        }

        return json({
          taskId: result.data.id,
          status: result.data.status,
          character: profile.name
        });

      } catch (error) {
        console.error("Kling video API error:", error?.message || String(error), error?.stack || "");

        return json({
          error: "Video generation could not be started."
        }, 502);
      }
    }

    // CHECK KLING VIDEO STATUS.
    if (url.pathname === "/api/video/status" && request.method === "GET") {
      try {
        if (!env.KLING_API_KEY) {
          return json({ error: "Kling API key is missing." }, 500);
        }

        const taskId = cleanText(url.searchParams.get("taskId"), 100);

        if (!/^[0-9]+$/.test(taskId)) {
          return json({ error: "Invalid video task ID." }, 400);
        }

        const response = await fetch(
          "https://api-singapore.klingai.com/tasks?task_ids=" + encodeURIComponent(taskId),
          {
            headers: {
              "Authorization": `Bearer ${env.KLING_API_KEY}`
            }
          }
        );

        const result = await response.json();

        if (!response.ok || result.code !== 0) {
          console.error("Kling status error:", result);

          return json({
            error: result.message || "Could not check video status."
          }, 502);
        }

        const task = Array.isArray(result.data) ? result.data[0] : null;

        if (!task) {
          return json({ error: "Video task was not found." }, 404);
        }

        const video = task.outputs?.find(item => item.type === "video");

        return json({
          status: task.status,
          videoUrl: task.status === "succeeded" ? video?.url || null : null,
          message: task.message || ""
        });

      } catch (error) {
        console.error("Kling status API error:", error?.message || String(error));

        return json({
          error: "Could not check video status."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API endpoint not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

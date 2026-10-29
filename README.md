# Heartmate — personal AI companion starter

A beginner-friendly, non-explicit AI companion website using Cloudflare Workers + Workers AI. The site is designed for personal use: conversations are stored in the current browser's `localStorage`, not in a user account or cloud database.

## Features

- Mobile-friendly dark interface and three fictional adult character personalities
- Flirty, non-explicit text chat
- Per-character chat history in the browser
- Optional generated character portraits through a Workers AI text-to-image model
- Backend endpoints at `/api/chat` and `/api/image`
- AI credentials are handled by Cloudflare bindings; no provider API key is exposed in browser JavaScript

## Before you start

You need:
- A Cloudflare account
- A computer with Node.js 20+ installed (for the command-line setup)
- Internet access

Cloudflare's plans and model availability can change. Workers AI's documented free allocation is currently 10,000 Neurons/day; requests can fail when the daily allocation is exhausted. Check the official pages linked below before relying on the free tier.

## Run locally

1. Install Node.js from https://nodejs.org/ (LTS).
2. Extract this ZIP to a folder.
3. Open a terminal in that folder.
4. Run:

   ```bash
   npm install
   npx wrangler login
   npm run dev
   ```

5. Open the local address printed by Wrangler (usually `http://localhost:8787`).
6. Chat requests use your Cloudflare Workers AI binding. Depending on account setup and Wrangler behavior, you may need to enable Workers AI in your Cloudflare account before the binding works.

## Deploy to Cloudflare

1. Create/sign in to your account at https://dash.cloudflare.com/
2. Make sure Workers AI is available on your account and review its free allocation.
3. In the project folder, run:

   ```bash
   npx wrangler login
   npm run deploy
   ```

4. Confirm the deployment when Wrangler prompts you. It will print your public `workers.dev` URL.
5. Open that URL on your phone. You can add it to your home screen from your mobile browser.

`wrangler.jsonc` configures the static `public/` files and the `AI` binding. No separate API key is needed for the built-in Workers AI binding.

## Image generation

The backend uses `@cf/black-forest-labs/flux-1-schnell` as a sample image model. Model availability, account requirements, input parameters, and output format may change. If the image button fails, open the current model catalogue and check the selected model's exact name and response format:
https://developers.cloudflare.com/workers-ai/models/

The image is generated as a temporary browser object URL. It is not uploaded to a permanent gallery; save it using the "Save portrait" link if you want to keep it.

## Free-tier notes

As documented at the time this starter was prepared:
- Workers AI: 10,000 Neurons/day at no charge; usage is model-dependent. If you exceed the free allocation, inference can fail until reset or require a paid plan.
- Workers Free: up to 100,000 Worker requests/day, subject to the current account plan and terms.
- Static site assets are served by the Worker assets configuration.
- AI image generation consumes AI usage too and can use the allocation quickly.
- A custom domain costs extra unless you already own one; the generated `workers.dev` address is enough to test.
- The website does not guarantee unlimited AI chat or unlimited image generation.

Official references:
- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers AI setup: https://developers.cloudflare.com/workers-ai/get-started/
- AI binding: https://developers.cloudflare.com/workers-ai/configuration/bindings/
- Model catalogue: https://developers.cloudflare.com/workers-ai/models/

## Important security and privacy notes

- Never place API keys or Cloudflare secrets in `public/app.js`, HTML, or other browser-visible files.
- The Worker validates and limits incoming message/prompt lengths and only passes the last 10 chat messages to the model. For personal testing, this is a useful starting guard, not a complete abuse-prevention system.
- This starter has no login, so anyone who can open the URL can use its AI endpoints. Keep the deployed URL private for personal use. For a public website, add authentication, server-side rate limiting, abuse controls, and a privacy notice before sharing it.
- `localStorage` is only in this browser profile. Clearing site data or switching browsers/devices removes or hides the saved chats. Anyone with access to your unlocked browser profile may be able to read them.
- Don't store highly sensitive information in companion chats.
- The AI is a fictional character, not a real person. Image generation is intentionally prompted for tasteful, non-explicit adult character portraits.

## Troubleshooting

**`AI.run` / model error:** Confirm Workers AI is enabled, review the model catalogue, and check your free allocation.

**Chat says it could not connect:** Open browser developer tools or run `npx wrangler tail` in a terminal to inspect server logs. Do not paste secrets into public issue reports.

**Image generation fails:** Check the current image model name and output type in Cloudflare's model catalogue. The provider may change model availability or account requirements.

**Deploy fails:** Run `npx wrangler --version`, then `npx wrangler deploy` again and read the exact error. The free account may require initial setup in the dashboard.

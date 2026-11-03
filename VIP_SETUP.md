# Heartmate AI VIP Membership setup

## Included

- Free plan remains the default.
- VIP Monthly: ₹299 for 30 days.
- VIP Yearly: ₹2,499 for 365 days.
- One-time prepaid purchases; no automatic renewal.
- VIP unlocks Elena, Amara, Isabelle, Celeste and Layla.
- Server-side VIP limits: 300 chats/day, 30 images/day, 5 videos/day, 100 voice transcriptions/day and 150 spoken replies/day.
- Payment verification is performed by the Worker using the Razorpay order, signature and captured-payment API response. The browser cannot grant VIP by itself.
- Membership and pending order records are stored in Cloudflare D1 and are removed by the account deletion endpoint.

## Configure Razorpay

1. Create or sign in to your Razorpay account.
2. In Razorpay, enable **Test Mode** and generate a Test Key ID and Test Key Secret.
3. From the repository root, configure both as Cloudflare Worker secrets:

   ```sh
   npx wrangler secret put RAZORPAY_KEY_ID
   npx wrangler secret put RAZORPAY_KEY_SECRET
   ```

4. Paste the Test Key ID and Test Key Secret when Wrangler prompts you.
5. Deploy the Worker:

   ```sh
   npx wrangler deploy
   ```

6. Visit `/membership.html`, sign in with Google and complete a Razorpay test payment. Confirm that the membership status changes to VIP and the five VIP companions open.
7. Before accepting real money, switch Razorpay to Live Mode, generate Live API keys, replace both Worker secrets using the same commands, and deploy again.

Never put the Razorpay Key Secret in HTML, JavaScript, GitHub source, or a public environment variable. Only the Key ID is returned to the checkout page.

## Important operational notes

- Prices and durations are defined in `src/index.js` in `VIP_PLANS`; the matching display text is in `Public/membership.html`. Keep both in sync if you change prices.
- This is a prepaid membership, not a recurring subscription. Users must purchase again after expiry.
- Razorpay account activation, KYC, settlement settings, taxes, refund policy and local legal requirements must be completed by the business owner before live launch.
- Test the complete flow with Razorpay Test Mode first. A GitHub commit alone does not mean the Cloudflare deployment or payment credentials are ready.

# البرومبت التقني الجاهز للإرسال لأي ذكاء اصطناعي (انسخ من هنا)

I am building a local marketplace/directory website for Al-Zulfi, a small governorate in Riyadh Province, Saudi Arabia. I am NOT asking for business ideas this time — I already have a clear business plan. I need **technical guidance** to help me build this correctly. Please answer with concrete, practical technical advice, not generic tutorials.

## Project context

- The platform connects local shops, home-based producers ("أسر منتجة"), service providers, real estate listings, and a person-to-person used-goods marketplace with local buyers in Al-Zulfi.
- I do NOT process payments or shipping for the actual product/service transactions — buyers and sellers connect via a WhatsApp/phone contact button and complete the deal themselves outside the platform.
- I DO need to process payments for one thing only: seller subscriptions (sellers get 5–10 free listings, then pay a monthly/yearly subscription to list more).
- Target scale for launch: a single small town (Al-Zulfi), likely a few hundred sellers and a few thousand monthly visitors in year one. Not designed for massive scale yet, but I do want the architecture to be able to expand to other similar Saudi towns later without a full rewrite (multi-tenant by region eventually).
- I am a solo founder (non-technical-ish, learning as I build), working on Windows, using Claude Code as my AI coding assistant.

## Already-made decisions (don't re-litigate these unless something is genuinely wrong)

- **Frontend/framework:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. I already have a working `create-next-app` boilerplate as my starting point.
- **Hosting target (planned):** Vercel for the Next.js app.
- I am deciding between **Firebase** (Auth + Firestore + Storage) and **Supabase** (Postgres + Auth + Storage) as my backend. I have prior hands-on experience with Firebase from a previous Flutter app (Firestore rules, Firebase Auth, Firebase Storage all already used in a real shipped project), but no prior experience with Supabase/Postgres.
- Payment gateway for subscriptions needs to support Saudi payment methods (mada, Apple Pay) — likely Moyasar, HyperPay, or Tap.

## What I actually want from you — technical questions

1. **Firebase vs Supabase for THIS specific use case**: Given the data model is relational-ish (sellers → listings → categories → subscriptions → payments, with filtering/search by category, city/neighborhood, price range), which backend is the better technical fit, and why? Be honest about trade-offs even though I have more experience with Firebase — if Postgres/Supabase is clearly better suited for this kind of relational, filterable marketplace data, tell me so and explain what I'd be trading off by sticking with Firebase out of familiarity.

2. **Data modeling**: What's a sensible schema/collection structure for: sellers, listings (which can be of different types — product, service, real estate, used-item — with different fields per type), categories (with subcategories), subscriptions, and payments? How would you handle the "different listing types need different fields" problem cleanly?

3. **Search and filtering**: For a marketplace with categories, price ranges, neighborhoods/location, and free-text search, what's the right approach given my stack? Is Postgres full-text search / Firestore's limited query capabilities enough, or do I need a dedicated search service (Algolia, Meilisearch, Typesense) even at this small scale, and at what point would I need one?

4. **Image handling**: Best practical approach for sellers uploading multiple product photos (upload flow, storage, resizing/optimization for fast page loads, and cost control at small scale) using my stack.

5. **Auth and roles**: How should I structure authentication for two different user types (buyers who mostly just browse, and sellers who need a dashboard) in Next.js App Router with my chosen backend? Do buyers even need accounts, or can most browsing/contacting be anonymous with only sellers requiring accounts?

6. **Enforcing the "5-10 free listings, then paid subscription" business rule**: What's a clean, hard-to-cheat way to enforce a free-tier listing limit and gate additional listings behind a subscription, including handling subscription expiration (what happens to listings 6-10 when a seller's subscription lapses)?

7. **Subscription billing integration**: Practical guidance on integrating a Saudi payment gateway (Moyasar, HyperPay, or Tap — whichever you'd recommend and why) with Next.js for recurring/renewable subscriptions, including webhook handling for renewal/expiration events.

8. **SEO for local listings**: Since local discoverability (people finding shops/producers via Google search) matters a lot for this business model, what specific Next.js technical practices (metadata, structured data/schema.org for LocalBusiness and Product, sitemap generation, ISR/SSR strategy per page type) should I prioritize?

9. **WhatsApp contact integration**: Best practical way to implement a "contact seller via WhatsApp" button (click-to-chat links vs WhatsApp Business API) including pre-filled message templates, and whether/how to track click events for analytics without adding friction.

10. **Deployment and cost at small scale**: Given this is a bootstrapped solo project expected to have modest traffic initially, what's a realistic, low-cost hosting/infrastructure setup (Vercel free/pro tier limits, database hosting costs, storage costs) I should plan for, and what usage level would force me to upgrade or re-architect?

11. **Project structure**: For a Next.js App Router project that will grow to include a public marketplace, a seller dashboard, and an admin panel (for approving new sellers/listings), what's a sensible folder/route structure and where should admin-only logic live securely?

12. **Anything else technically important** I haven't asked about but should know before I go further — common pitfalls solo founders hit when building this type of local marketplace app with this exact stack.

## Format of your answer

Please respond in **Arabic** (Saudi/Gulf-friendly Arabic is fine, but keep technical terms — package names, API names, code identifiers — in English since translating them would be confusing). Organize your answer by the numbered questions above. Be specific and opinionated — if you have a clear recommendation, state it directly instead of listing every possible option neutrally. Short code snippets or config examples are welcome where they clarify a point, but I'm not asking you to write the full implementation — just guidance and reasoning I can act on myself (with Claude Code) afterward.

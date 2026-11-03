# Firebase #BuildHybridAI 2026 — pre-build spec

Target: https://firebasehybridaihackathon.devpost.com  | $10,000 cash, WORLDWIDE, online.
Submissions Nov 9 -> Nov 30 14:00 PT. Judged on how well the app uses HYBRID inference.
Why us: it's a client-side web app using the Firebase JS SDK = our exact Ship Kit skill. Worldwide = India eligible.
Run ends ~Nov 6, so we PRE-BUILD deploy-ready now and submit after owner does the 2 login steps on/after Nov 9.

## What "hybrid inference" means here (verify against rules when they drop Nov 9)
Firebase AI Logic JS SDK supports on-device (Chrome built-in Gemini Nano via the Prompt API, Chrome 138/139+) with
automatic CLOUD fallback (Gemini via Vertex/Google AI) using `InferenceMode.PREFER_ON_DEVICE`. The judged behaviour:
run free/private/offline on-device when available, transparently fall back to cloud when not. Single-turn text.

## App concept (pick the one that best shows hybrid, build ONE)
RECOMMENDED: "ShipCopy" — on-device copy assistant for indie makers. Paste an app/product description; it generates
app-store subtitle, OG/meta description, 3 tweet variants, and alt-text. Ties directly into the Ship Kit suite
(AppShot/ogkit/Favikit) so it's not a throwaay demo — it becomes a 4th tool that is ALSO a hackathon entry.
Hybrid angle is honest: short prompts run on-device (private, instant, offline); long/complex ones fall back to cloud.
UI shows a live "⚡ on-device" vs "☁ cloud" badge per generation = exactly what judges want to see.

## Core module to build now (testable without the cloud key)
- `hybrid.js`: wrap firebase/ai getGenerativeModel with mode PREFER_ON_DEVICE; detect `window.LanguageModel`/
  availability; expose `generate(prompt) -> {text, backend:'on-device'|'cloud'}`. Fall back to cloud model when
  on-device unavailable. Unit-test the routing logic with a mocked availability flag.
- UI shell (reuse Ship Kit dark theme + footer). Fully buildable/deployable to GitHub Pages now; the only owner-
  gated piece is the Firebase web config (apiKey/projectId) for the cloud path.

## Owner steps (OWNER CHECKLIST — ~5 min, on/after Nov 9)
1. Firebase console (console.firebase.google.com) "Sign in with Google"; create a project; add a Web app; enable
   Firebase AI Logic; copy the web config object into `firebase-config.js`.
2. Devpost: register on the hackathon (eligibility tick + last-name field = owner only).
3. For on-device testing: Chrome 139+ with the built-in AI / Prompt API available (chrome://flags if needed).

## Open risks
- Rules not public until Nov 9: confirm "hybrid" definition + whether a specific SDK/API is mandated before deep build.
- Gemini Nano on-device availability is Chrome-version/hardware gated; the app MUST degrade gracefully to cloud-only
  (and say so) or it looks broken on judges' machines.

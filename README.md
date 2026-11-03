# ShipCopy — Firebase #BuildHybridAI 2026 entry (pre-built; submit after Nov 9)

Live: https://arnavjhajharia.github.io/shipcopy/  ·  Repo: github.com/arnavjhajharia/shipcopy  ·  Contest: https://firebasehybridaihackathon.devpost.com
($10,000 single grand prize, submissions Nov 9 – Nov 30 2026 14:00 PT; 352 registrants at Nov 3.)

What it does: paste a raw changelog / git log → App Store "What's New", markdown release notes, a launch post, a meta
description. Hybrid inference via Firebase AI Logic: `PREFER_ON_DEVICE` (Chrome built-in Gemini Nano) for small inputs,
cloud Gemini fallback for big inputs / browsers without the model. Every result shows a badge sourced from the SDK's
`response.inferenceSource`, so the judged behaviour (hybrid routing) is visible, not claimed.

Why hybrid is honest here: pre-release changelogs are private (unreleased features, internal ticket IDs). On-device keeps
them local, free and offline; cloud only when needed (>~6k tokens or no Nano).

## Files
- index.html — UI (Ship Kit theme + footer). Loads Firebase 13.2.0 ESM from gstatic CDN (no build step).
- hybrid.js — `chooseRoute()` (pure routing policy) + `createEngine()` (Firebase AI wrapper, SDK injected).
- firebase-config.js — `null` until the owner pastes the web config (cloud path). On-device still works without it.
- test/router.test.mjs — `node --test test/` (15 tests: routing matrix, JSON parsing, engine with mocked SDK).

## Judging criteria (from the Devpost page) → how we hit them
- Technological implementation / hybrid use: real SDK modes, inferenceSource badge, download warm-up, structured JSON on both paths.
- Design (complete product, not a PoC): 4 outputs with char budgets + copy, sample loader, status panel, graceful degradation.
- Impact: indie devs ship releases weekly and hand-write this copy; private by default.
- Idea: non-obvious use — privacy of UNRELEASED changelogs is the reason on-device matters.

## Owner steps (OWNER CHECKLIST, ~8 min total, on/after Nov 9)
1. Firebase console (Google sign-in) → new project "shipcopy" → Add web app → Build → AI Logic → Get started → Gemini
   Developer API. Copy the `firebaseConfig` into firebase-config.js, commit, push (Pages redeploys in ~1 min).
   Optional: App Check (reCAPTCHA v3) + restrict the API key to https://arnavjhajharia.github.io/*.
2. Devpost: register (eligibility tick + last name), then when the rules drop Nov 9 re-check the "hybrid" requirement
   and submission fields (likely: hosted URL, repo, 3-min demo video, write-up). Agents can draft the write-up/video script.
3. For the demo video, use Chrome 139+ desktop with chrome://flags/#prompt-api-for-gemini-nano-multimodal-input enabled so
   the ⚡ on-device badge shows; then force "Cloud only" to show the ☁ fallback.

## Status (2026-11-03, builder s7)
- Built + unit-tested + deployed. Smoke test in the owner's Chrome: see LEARNINGS (on-device availability depends on the
  Chrome build; cloud path untested until the owner adds the config).

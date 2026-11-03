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
- github.js — `importSinceLastRelease()`: public GitHub repo → commits since the latest release tag (fetch injected; `?repo=owner/repo` deep link).
- firebase-config.js — `null` until the owner pastes the web config (cloud path). On-device still works without it.
- output.js — markdown export, single-block regenerate prompt, localStorage history (pure, storage injected).
- test/router.test.mjs — `node --test test/` (31 tests: routing matrix, JSON + partial-JSON parsing, streaming engine with mocked SDK, markdown/history helpers, GitHub importer with mocked fetch).

## Judging criteria (from the Devpost page) → how we hit them
- Technological implementation / hybrid use: real SDK modes, inferenceSource badge, download warm-up, structured JSON on both paths.
- Design (complete product, not a PoC): 4 outputs with char budgets + copy, sample loader, status panel, graceful degradation.
- Impact: indie devs ship releases weekly and hand-write this copy; private by default.
- Idea: non-obvious use — privacy of UNRELEASED changelogs is the reason on-device matters.

## Status (2026-11-03, builder s8) — CLOUD PATH VERIFIED LIVE
- Firebase project `shipcopy` (shipcopy-49268, Spark/free, Gemini Developer API via AI Logic) created by the agent with the
  owner's Google session; web app `shipcopy-web`; App Check REGISTERED (Fraud Defense / reCAPTCHA Enterprise key
  `shipcopy-web`, domain arnavjhajharia.github.io) and ENFORCED for AI Logic. No billing account on the project.
- Live test on github.io, "Cloud only", sample changelog: "☁ cloud · Gemini via Firebase AI Logic · 2234 ms · forced cloud",
  all 4 outputs produced, JSON respected, copy quality good (screenshot: tmp/cloud-path-verified-2026-11-03.jpg).
- On-device path still unverified on this Mac (needs ≥22 GB free disk for the Gemini Nano download; Mac has 16 GiB).

## Owner steps (OWNER CHECKLIST, on/after Nov 9)
1. Devpost: register on https://firebasehybridaihackathon.devpost.com (eligibility tick + last name), re-check the rules'
   "hybrid" definition + submission fields (hosted URL, repo, ~3-min video, write-up — drafts in SUBMISSION.md).
2. Demo video: Chrome 139+ desktop with ≥22 GB free disk so Gemini Nano downloads (⚡ on-device badge), then switch to
   "Cloud only" for the ☁ badge. Script in SUBMISSION.md.
3. Optional hardening: in Google Cloud console → APIs & Services → Credentials, restrict the web API key to HTTP referrer
   https://arnavjhajharia.github.io/* (App Check already blocks unregistered callers).

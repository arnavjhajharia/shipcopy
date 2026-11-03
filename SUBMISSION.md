# Devpost submission draft — ShipCopy (#BuildHybridAI 2026)
(Fill the real form on/after Nov 9 once the rules + required fields are public. Keep claims to what the live app does.)
Verified 2026-11-03: cloud path live (Firebase AI Logic + Gemini + App Check enforced, 2.2 s for the sample). On-device path
not yet verified on our hardware (disk gate).

## Tagline
Paste a raw changelog, get store-ready launch copy — generated on your device, with a transparent cloud fallback.

## Inspiration
Every release, indie devs hand-write the same four things: the App Store "What's New", release notes, a launch post and a
meta description. The raw source is a git log full of unreleased features and internal ticket IDs — exactly the kind of
text you don't want to paste into a random web tool. Hybrid inference solves this properly: small inputs run on-device
with Chrome's built-in Gemini Nano (private, free, offline); only oversized inputs, or browsers without the model, go to
Gemini in the cloud via Firebase AI Logic — and the app tells you which one answered.

## What it does
- Input: product, version, platform, tone, and the raw changelog / git log.
- Output: What's New (≤500 chars), markdown release notes, launch post (≤280), meta description (≤155), each with a
  character budget and copy button. Structured JSON on both backends (Prompt API `responseConstraint` on-device,
  `responseMimeType: application/json` in the cloud).
- A per-result badge driven by the SDK's `response.inferenceSource` (ON_DEVICE / IN_CLOUD), latency, and the routing reason.
- Status panel: on-device availability (available / downloadable / downloading / unavailable) with a one-click model
  download + progress, cloud configured or not, online/offline.
- Inference policy: Auto (hybrid), On-device only, Cloud only.
- **Import from GitHub**: type `owner/repo` (or open `?repo=owner/repo`) and ShipCopy pulls the commits since the latest
  release tag through the public GitHub API (3-5 requests, no login), turns merge commits into PR titles, drops branch
  merges and version-bump commits, and pre-fills product + next version. If nothing has landed since the latest
  release, it describes that release (previous tag → release tag). Only the public commit list is fetched; the copy is
  still written on-device when Gemini Nano is available.

## How we built it
Firebase JS SDK 13.2 (`firebase/ai`, `firebase/app-check` with reCAPTCHA Enterprise — AI Logic enforces App Check) with `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })`.
A small pure routing module (`chooseRoute`) picks PREFER_ON_DEVICE / PREFER_IN_CLOUD / ONLY_* from: Prompt API
availability, estimated tokens vs the on-device 9,216-token limit, online state, and whether cloud is configured.
24 unit tests (node --test) cover the routing matrix, the engine with a mocked SDK and the GitHub importer with a mocked fetch. Zero build step, static hosting.

## Challenges
On-device Gemini Nano is only present on some Chrome builds/hardware and needs a multi-minute first download, so the app
must stay useful during "downloadable"/"downloading" states (route to cloud if configured, otherwise wait on-device).
JSON output has to be requested differently per backend.

## What's next
Streaming output on-device, image input (screenshot → alt text) using the Prompt API's multimodal support, and private
repos via a user-supplied token kept in the browser.

## Links
Live: https://arnavjhajharia.github.io/shipcopy/   Repo: https://github.com/arnavjhajharia/shipcopy
Demo video script: 0) type sindresorhus/ky → Import changes (80 real commits, v2.1.0 → v2.2.0) 1) load sample → Auto → ⚡ on-device badge (offline toggle to prove it) 2) paste a huge changelog →
☁ cloud badge with the "exceeds on-device budget" reason 3) switch to Cloud only / On-device only.

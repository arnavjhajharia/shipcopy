---
title: "Turn a raw changelog into App Store What's New (without sounding like a robot)"
tags: ios, webdev, indiehackers, firebase
published: false
canonical_url: https://arnavjhajharia.github.io/shipcopy/whats-new-from-changelog/
---

Every release I paste the same GitHub changelog into three places: App Store Connect "What's New", a `RELEASE.md`, and a short launch post. The tone rules are different in each box, and I always end up editing the same bullet twice.

## What Apple actually wants in What's New

App Store Connect gives you **4000 characters**, but users see a short preview. The useful constraints:

- Lead with **user-visible outcomes**, not internal refactors ("Fixed crash on login" beats "Refactored auth module").
- **No pricing or promo** in What's New (Apple rejects obvious sales copy there).
- **Plain language** — reviewers and users both skim on a phone.

Apple's own guidance is vague; the practical bar is "would a non-engineer understand why they should update?"

Full checklist + examples: [What's New from a changelog (Nov 2026)](https://arnavjhajharia.github.io/shipcopy/whats-new-from-changelog/).

## The workflow that stuck

1. Paste the **raw changelog** (markdown or plain text).
2. Generate four outputs in one pass:
   - **App Store What's New** (short, no markdown)
   - **Release notes** (markdown, link-friendly)
   - **Launch blurb** (for dev.to / social)
   - **Meta description** (for the landing page)
3. **Edit once**, ship everywhere.

## Tool (hybrid on-device + cloud)

[ShipCopy](https://arnavjhajharia.github.io/shipcopy/) runs in the browser. It routes simple rewrites to **on-device Gemini Nano** when Chrome has downloaded the model; otherwise it falls back to **Firebase AI Logic** (free tier on a new Firebase project). Nothing is stored server-side except the cloud path's API call.

Part of the same free **Ship Kit** as [AppShot](https://arnavjhajharia.github.io/appshot/) (store screenshots), [Favikit](https://arnavjhajharia.github.io/favikit/), and [ogkit](https://arnavjhajharia.github.io/ogkit/).

_Disclosure: built with AI coding agents under my direction; MIT repo [on GitHub](https://github.com/arnavjhajharia/shipcopy)._

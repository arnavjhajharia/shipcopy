// hybrid.js — routing + engine for ShipCopy (Firebase AI Logic hybrid inference).
// Pure routing logic lives in chooseRoute() so it can be unit-tested in Node without Firebase or Chrome.

export const DEVICE_TOKEN_LIMIT = 9216;   // Chrome Prompt API (Gemini Nano) context limit per Firebase docs
export const DEVICE_SAFE_INPUT = 6000;    // leave room for the system prompt + JSON output

export const MODE = {
  PREFER_ON_DEVICE: "prefer_on_device",
  ONLY_ON_DEVICE: "only_on_device",
  ONLY_IN_CLOUD: "only_in_cloud",
  PREFER_IN_CLOUD: "prefer_in_cloud",
};

export function estimateTokens(text) {
  return Math.ceil((text || "").trim().length / 4);
}

/**
 * Decide which Firebase AI Logic inference mode to use.
 * @param {object} o
 * @param {'auto'|'device'|'cloud'} o.policy   user preference
 * @param {'available'|'downloadable'|'downloading'|'unavailable'} o.availability  Chrome Prompt API state
 * @param {boolean} o.online
 * @param {boolean} o.cloudConfigured   firebase web config present
 * @param {number}  o.estTokens
 * @returns {{mode:string|null, expect:'on-device'|'cloud'|null, reason:string, error?:string}}
 */
export function chooseRoute({ policy = "auto", availability = "unavailable", online = true, cloudConfigured = false, estTokens = 0 } = {}) {
  const tooBig = estTokens > DEVICE_SAFE_INPUT;
  const deviceReady = availability === "available";
  const deviceSoon = availability === "downloadable" || availability === "downloading";
  const deviceAny = deviceReady || deviceSoon;
  const cloudOk = cloudConfigured && online;

  if (policy === "device") {
    if (!deviceAny) return { mode: null, expect: null, reason: "", error: "On-device model is not available in this browser (needs Chrome 139+ desktop with the Prompt API)." };
    if (tooBig) return { mode: null, expect: null, reason: "", error: `Input is ~${estTokens} tokens; the on-device model handles about ${DEVICE_SAFE_INPUT}. Trim it or switch to Auto.` };
    return { mode: MODE.ONLY_ON_DEVICE, expect: "on-device", reason: deviceReady ? "forced on-device" : "forced on-device (waiting for model download)" };
  }
  if (policy === "cloud") {
    if (!cloudConfigured) return { mode: null, expect: null, reason: "", error: "Cloud is not configured (no Firebase web config). Add firebase-config.js or use on-device." };
    if (!online) return { mode: null, expect: null, reason: "", error: "You are offline; cloud inference needs a connection." };
    return { mode: MODE.ONLY_IN_CLOUD, expect: "cloud", reason: "forced cloud" };
  }
  // auto
  if (deviceReady && !tooBig) {
    return { mode: MODE.PREFER_ON_DEVICE, expect: "on-device", reason: `~${estTokens} tokens fits on-device: private, free, works offline` };
  }
  if (cloudOk) {
    const why = tooBig ? `~${estTokens} tokens exceeds the on-device budget (${DEVICE_SAFE_INPUT})`
      : deviceSoon ? "on-device model is still downloading" : "no on-device model in this browser";
    return { mode: deviceAny ? MODE.PREFER_IN_CLOUD : MODE.ONLY_IN_CLOUD, expect: "cloud", reason: why };
  }
  if (deviceSoon && !tooBig) {
    return { mode: MODE.ONLY_ON_DEVICE, expect: "on-device", reason: "cloud unavailable; waiting for on-device model download" };
  }
  if (tooBig && deviceAny) {
    return { mode: null, expect: null, reason: "", error: `Input is ~${estTokens} tokens, too large for on-device, and cloud is ${cloudConfigured ? "offline" : "not configured"}. Trim the input.` };
  }
  return { mode: null, expect: null, reason: "", error: `No AI backend available: on-device model unavailable and cloud ${cloudConfigured ? "offline" : "not configured"}.` };
}

export function parseJsonLoose(text) {
  if (!text) throw new Error("empty response");
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("response was not JSON");
}

/**
 * Decode the string fields of a possibly-incomplete JSON object, e.g. '{"a":"hi","b":"wor'
 * -> { a: "hi", b: "wor" }. Used to paint streaming output before the JSON closes.
 */
export function partialJsonStrings(text) {
  const out = {};
  const s = String(text || "");
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"/g;
  let m;
  while ((m = re.exec(s))) {
    let key; try { key = JSON.parse('"' + m[1] + '"'); } catch (_) { continue; }
    let i = re.lastIndex, raw = "", closed = false;
    while (i < s.length) {
      const c = s[i];
      if (c === "\\") { if (i + 1 >= s.length) break; raw += c + s[i + 1]; i += 2; continue; }
      if (c === '"') { closed = true; i++; break; }
      raw += c; i++;
    }
    // drop a dangling partial escape like \u00 so JSON.parse succeeds
    let val; const fix = closed ? raw : raw.replace(/\\u[0-9a-fA-F]{0,3}$/, "");
    try { val = JSON.parse('"' + fix + '"'); } catch (_) { val = fix.replace(/\\n/g, "\n").replace(/\\"/g, '"'); }
    out[key] = val;
    re.lastIndex = i;
  }
  return out;
}

/**
 * Create an engine bound to the Firebase AI SDK (passed in so tests can mock it).
 * sdk = { initializeApp, getAI, getGenerativeModel, GoogleAIBackend }
 */
export function createEngine(sdk, { config, systemPrompt, jsonSchema, cloudModel = "gemini-3.5-flash-lite", win = (typeof window !== "undefined" ? window : undefined) } = {}) {
  const cloudConfigured = !!(config && config.apiKey && config.projectId);
  // A placeholder app is enough for on-device-only use; cloud calls are gated by chooseRoute().
  const app = sdk.initializeApp(cloudConfigured ? config : { apiKey: "unconfigured", projectId: "unconfigured", appId: "unconfigured" });
  // Optional Firebase App Check (reCAPTCHA Enterprise). AI Logic enforces it by default on new projects.
  if (cloudConfigured && config.appCheckSiteKey && sdk.initializeAppCheck && sdk.ReCaptchaEnterpriseProvider) {
    sdk.initializeAppCheck(app, { provider: new sdk.ReCaptchaEnterpriseProvider(config.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  const ai = sdk.getAI(app, { backend: new sdk.GoogleAIBackend() });
  const createOptions = {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
    initialPrompts: [{ role: "system", content: [{ type: "text", value: systemPrompt }] }],
  };
  const models = new Map();
  function model(mode) {
    if (!models.has(mode)) {
      models.set(mode, sdk.getGenerativeModel(ai, {
        mode,
        inCloudParams: {
          model: cloudModel,
          systemInstruction: systemPrompt,
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        },
        onDeviceParams: {
          createOptions,
          promptOptions: jsonSchema ? { responseConstraint: jsonSchema } : undefined,
        },
      }));
    }
    return models.get(mode);
  }

  async function availability() {
    try {
      const LM = win && win.LanguageModel;
      if (!LM || typeof LM.availability !== "function") return "unavailable";
      const a = await LM.availability({ expectedInputs: createOptions.expectedInputs, expectedOutputs: createOptions.expectedOutputs });
      return a || "unavailable";
    } catch (_) { return "unavailable"; }
  }

  async function warmup(onProgress) {
    // Must be called from a user gesture. Triggers the Gemini Nano download if needed.
    await model(MODE.PREFER_ON_DEVICE).initializeDeviceModel(onProgress);
  }

  const now = () => (win && win.performance ? win.performance.now() : Date.now());
  /**
   * generate(prompt, { policy, online, onChunk })
   * With onChunk, streams via generateContentStream and calls onChunk({ text, partial, firstMs })
   * as text arrives (partial = fields decoded so far from the incomplete JSON).
   */
  async function generate(prompt, { policy = "auto", online = (win && typeof win.navigator?.onLine === "boolean") ? win.navigator.onLine : true, onChunk } = {}) {
    const avail = await availability();
    const estTokens = estimateTokens(prompt) + estimateTokens(systemPrompt);
    const route = chooseRoute({ policy, availability: avail, online, cloudConfigured, estTokens });
    if (route.error) { const e = new Error(route.error); e.route = route; e.availability = avail; throw e; }
    const t0 = now();
    const m = model(route.mode);
    let text = "", src, firstMs = null, streamed = false;
    if (typeof onChunk === "function" && typeof m.generateContentStream === "function") {
      streamed = true;
      const result = await m.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        let t = ""; try { t = chunk.text(); } catch (_) {}
        if (chunk.inferenceSource) src = chunk.inferenceSource;
        if (!t) continue;
        if (firstMs === null) firstMs = Math.round(now() - t0);
        text += t;
        const live = src === "on_device" ? "on-device" : src === "in_cloud" ? "cloud" : route.expect;
        try { onChunk({ text, partial: partialJsonStrings(text), firstMs, route, backend: live }); } catch (_) {}
      }
      const resp = await result.response;
      if (resp) { if (resp.inferenceSource) src = resp.inferenceSource; try { const full = resp.text(); if (full && full.length >= text.length) text = full; } catch (_) {} }
    } else {
      const result = await m.generateContent(prompt);
      text = result.response.text();
      src = result.response.inferenceSource; // 'on_device' | 'in_cloud'  (SDK >= 12.5)
    }
    const ms = Math.round(now() - t0);
    const backend = src === "on_device" ? "on-device" : src === "in_cloud" ? "cloud" : route.expect;
    let data = null, parseError = null;
    try { data = parseJsonLoose(text); } catch (e) { parseError = e.message; }
    return { text, data, parseError, backend, route, availability: avail, ms, firstMs, streamed, estTokens };
  }

  return { availability, warmup, generate, cloudConfigured, estimateTokens, chooseRoute };
}

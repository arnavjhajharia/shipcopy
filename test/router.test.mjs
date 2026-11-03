import test from "node:test";
import assert from "node:assert/strict";
import { chooseRoute, estimateTokens, parseJsonLoose, createEngine, MODE, DEVICE_SAFE_INPUT } from "../hybrid.js";

test("auto: device available & small input -> prefer_on_device", () => {
  const r = chooseRoute({ availability: "available", cloudConfigured: true, estTokens: 500 });
  assert.equal(r.mode, MODE.PREFER_ON_DEVICE); assert.equal(r.expect, "on-device");
});
test("auto: device available but input too big -> cloud (prefer_in_cloud keeps device as fallback)", () => {
  const r = chooseRoute({ availability: "available", cloudConfigured: true, estTokens: DEVICE_SAFE_INPUT + 1 });
  assert.equal(r.mode, MODE.PREFER_IN_CLOUD); assert.equal(r.expect, "cloud"); assert.match(r.reason, /exceeds/);
});
test("auto: no device, cloud configured -> only_in_cloud", () => {
  const r = chooseRoute({ availability: "unavailable", cloudConfigured: true, estTokens: 100 });
  assert.equal(r.mode, MODE.ONLY_IN_CLOUD);
});
test("auto: device downloading, cloud configured -> cloud now (don't block the user)", () => {
  const r = chooseRoute({ availability: "downloading", cloudConfigured: true, estTokens: 100 });
  assert.equal(r.mode, MODE.PREFER_IN_CLOUD); assert.match(r.reason, /downloading/);
});
test("auto: device downloadable, no cloud -> only_on_device (waits for download)", () => {
  const r = chooseRoute({ availability: "downloadable", cloudConfigured: false, estTokens: 100 });
  assert.equal(r.mode, MODE.ONLY_ON_DEVICE);
});
test("auto: nothing available -> error, no mode", () => {
  const r = chooseRoute({ availability: "unavailable", cloudConfigured: false });
  assert.equal(r.mode, null); assert.match(r.error, /No AI backend/);
});
test("auto: offline with device available -> on-device still works", () => {
  const r = chooseRoute({ availability: "available", online: false, cloudConfigured: true, estTokens: 10 });
  assert.equal(r.mode, MODE.PREFER_ON_DEVICE);
});
test("auto: offline, no device -> error mentions offline", () => {
  const r = chooseRoute({ availability: "unavailable", online: false, cloudConfigured: true });
  assert.match(r.error, /offline/);
});
test("policy device: forced; errors when unavailable or too big", () => {
  assert.equal(chooseRoute({ policy: "device", availability: "available" }).mode, MODE.ONLY_ON_DEVICE);
  assert.match(chooseRoute({ policy: "device", availability: "unavailable" }).error, /not available/);
  assert.match(chooseRoute({ policy: "device", availability: "available", estTokens: 99999 }).error, /tokens/);
});
test("policy cloud: forced; errors when unconfigured or offline", () => {
  assert.equal(chooseRoute({ policy: "cloud", cloudConfigured: true }).mode, MODE.ONLY_IN_CLOUD);
  assert.match(chooseRoute({ policy: "cloud", cloudConfigured: false }).error, /not configured/);
  assert.match(chooseRoute({ policy: "cloud", cloudConfigured: true, online: false }).error, /offline/);
});
test("estimateTokens ~ chars/4", () => { assert.equal(estimateTokens("a".repeat(400)), 100); assert.equal(estimateTokens(""), 0); });
test("parseJsonLoose handles fences and prose", () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Sure! {"a":[1,2]} done'), { a: [1, 2] });
  assert.throws(() => parseJsonLoose("nope"));
});

// Engine with a mocked SDK: verifies mode selection reaches getGenerativeModel and inferenceSource is surfaced.
function mockSdk(calls, src) {
  return {
    initializeApp: (c) => ({ c }),
    getAI: () => ({}),
    GoogleAIBackend: class {},
    getGenerativeModel: (ai, params) => {
      calls.push(params);
      return {
        initializeDeviceModel: async () => {},
        generateContent: async () => ({ response: { text: () => '{"whatsNew":"x"}', inferenceSource: src } }),
      };
    },
  };
}
test("engine: unconfigured + device available -> on-device, reports backend from inferenceSource", async () => {
  const calls = [];
  const win = { LanguageModel: { availability: async () => "available" }, navigator: { onLine: true } };
  const eng = createEngine(mockSdk(calls, "on_device"), { config: null, systemPrompt: "sys", jsonSchema: { type: "object" }, win });
  assert.equal(eng.cloudConfigured, false);
  const r = await eng.generate("hello");
  assert.equal(r.backend, "on-device"); assert.equal(r.route.mode, MODE.PREFER_ON_DEVICE); assert.deepEqual(r.data, { whatsNew: "x" });
  assert.equal(calls[0].mode, MODE.PREFER_ON_DEVICE);
  assert.equal(calls[0].onDeviceParams.promptOptions.responseConstraint.type, "object");
  assert.equal(calls[0].inCloudParams.generationConfig.responseMimeType, "application/json");
});
test("engine: unconfigured + no device -> throws a clear error", async () => {
  const eng = createEngine(mockSdk([], null), { config: null, systemPrompt: "sys", win: {} });
  await assert.rejects(() => eng.generate("hi"), /No AI backend/);
});
test("engine: configured + no device -> cloud", async () => {
  const calls = [];
  const eng = createEngine(mockSdk(calls, "in_cloud"), { config: { apiKey: "k", projectId: "p" }, systemPrompt: "sys", win: {} });
  const r = await eng.generate("hi");
  assert.equal(r.backend, "cloud"); assert.equal(calls[0].mode, MODE.ONLY_IN_CLOUD);
});

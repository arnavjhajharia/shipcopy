import test from "node:test";
import assert from "node:assert/strict";
import { toMarkdown, regeneratePrompt, loadHistory, addHistory, updateHistory, clearHistory, HISTORY_KEY } from "../output.js";
import { partialJsonStrings, createEngine, MODE } from "../hybrid.js";

const FIELDS = [["whatsNew", "What's New", 500], ["launchPost", "Launch post", 280]];
function mem() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }

test("partialJsonStrings: decodes closed + open fields, escapes, fences", () => {
  assert.deepEqual(partialJsonStrings('{"whatsNew":"• a\\n• b","launchPost":"v2 is ou'), { whatsNew: "• a\n• b", launchPost: "v2 is ou" });
  assert.deepEqual(partialJsonStrings('{"a":"say \\"hi\\"","b":"x\\u00'), { a: 'say "hi"', b: "x" });
  assert.deepEqual(partialJsonStrings("```json\n{\"a\":\"done\"}\n```"), { a: "done" });
  assert.deepEqual(partialJsonStrings('{"a'), {});
  assert.deepEqual(partialJsonStrings(""), {});
});
test("toMarkdown: headings, char counts, skips empty, backend footer", () => {
  const md = toMarkdown({ product: "Ky", version: "2.0.0", data: { whatsNew: "• faster", launchPost: "" }, fields: FIELDS, backend: "on-device" });
  assert.match(md, /^# Ky 2\.0\.0 — launch copy/);
  assert.match(md, /## What's New\n_8\/500 characters_\n\n• faster/);
  assert.doesNotMatch(md, /Launch post/);
  assert.match(md, /on-device with Gemini Nano/);
  assert.match(toMarkdown({ data: {}, fields: FIELDS }), /^# Release — launch copy/);
});
test("regeneratePrompt: names the field, limit, carries the current draft", () => {
  const p = regeneratePrompt("BASE", { key: "launchPost", label: "Launch post", limit: 280, current: { launchPost: "old" } });
  assert.match(p, /^BASE/); assert.match(p, /ONLY the "launchPost" field/); assert.match(p, /under 280/); assert.match(p, /"launchPost":"old"/);
});
test("history: newest first, dedupes identical results, caps at max, survives bad JSON", () => {
  const s = mem();
  addHistory(s, { product: "A", version: "1", data: { x: 1 } }, { now: 1 });
  addHistory(s, { product: "B", version: "1", data: { x: 2 } }, { now: 2 });
  let l = addHistory(s, { product: "A", version: "1", data: { x: 1 } }, { now: 3 });
  assert.deepEqual(l.map(h => h.product), ["A", "B"]); assert.equal(l[0].id, "3");
  for (let i = 0; i < 15; i++) l = addHistory(s, { product: "P" + i, data: {} }, { now: 10 + i, max: 10 });
  assert.equal(l.length, 10); assert.equal(l[0].product, "P14");
  l = updateHistory(s, "24", { data: { y: 1 } }); assert.deepEqual(l[0].data, { y: 1 });
  s.setItem(HISTORY_KEY, "{not json"); assert.deepEqual(loadHistory(s), []);
  assert.deepEqual(clearHistory(s), []); assert.equal(s.getItem(HISTORY_KEY), null);
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(addHistory(broken, { product: "Z", data: {} }).length, 1);
});

function streamSdk(chunks, src, { finalText } = {}) {
  return {
    initializeApp: c => ({ c }), getAI: () => ({}), GoogleAIBackend: class {},
    getGenerativeModel: () => ({
      generateContent: async () => { throw new Error("should stream"); },
      generateContentStream: async () => ({
        stream: (async function* () { for (const c of chunks) yield { text: () => c, inferenceSource: src }; })(),
        response: Promise.resolve({ text: () => finalText ?? chunks.join(""), inferenceSource: src }),
      }),
    }),
  };
}
test("engine stream: onChunk sees growing partial fields; final data + firstMs + backend", async () => {
  const seen = [];
  const win = { LanguageModel: { availability: async () => "available" }, navigator: { onLine: true }, performance: { now: (() => { let t = 0; return () => (t += 5); })() } };
  const eng = createEngine(streamSdk(['{"whatsNew":"• fa', 'ster","launchPost":"v2', '"}'], "on_device"), { config: null, systemPrompt: "s", win });
  const r = await eng.generate("p", { onChunk: c => seen.push(c.partial) });
  assert.equal(seen.length, 3);
  assert.deepEqual(seen[0], { whatsNew: "• fa" });
  assert.deepEqual(seen[1], { whatsNew: "• faster", launchPost: "v2" });
  assert.deepEqual(r.data, { whatsNew: "• faster", launchPost: "v2" });
  assert.equal(r.backend, "on-device"); assert.equal(r.streamed, true);
  assert.ok(r.firstMs > 0 && r.firstMs <= r.ms);
});
test("engine stream: cloud source from chunks; a throwing onChunk doesn't break generation", async () => {
  const eng = createEngine(streamSdk(['{"a":"1"}'], "in_cloud"), { config: { apiKey: "k", projectId: "p" }, systemPrompt: "s", win: {} });
  const r = await eng.generate("p", { onChunk: () => { throw new Error("ui bug"); } });
  assert.equal(r.backend, "cloud"); assert.deepEqual(r.data, { a: "1" });
});
test("engine: without onChunk still uses generateContent (non-stream path unchanged)", async () => {
  const sdk = { initializeApp: c => ({ c }), getAI: () => ({}), GoogleAIBackend: class {},
    getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '{"a":"x"}', inferenceSource: "in_cloud" } }), generateContentStream: async () => { throw new Error("no"); } }) };
  const r = await createEngine(sdk, { config: { apiKey: "k", projectId: "p" }, systemPrompt: "s", win: {} }).generate("p");
  assert.equal(r.streamed, false); assert.deepEqual(r.data, { a: "x" });
});

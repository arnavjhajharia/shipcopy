// output.js — pure helpers for ShipCopy results: markdown export, single-field regenerate prompt, local history.
// No DOM; storage is injected so it runs in Node tests.

export function toMarkdown({ product = "", version = "", data = {}, fields = [], backend = "" } = {}) {
  const title = [product.trim() || "Release", version.trim()].filter(Boolean).join(" ");
  const parts = [`# ${title} — launch copy`];
  for (const [k, label, limit] of fields) {
    const v = String(data[k] ?? "").trim();
    if (!v) continue;
    parts.push(`## ${label}\n_${v.length}/${limit} characters_\n\n${v}`);
  }
  if (backend) parts.push(`---\n_Written ${backend === "on-device" ? "on-device with Gemini Nano" : "in the cloud with Gemini via Firebase AI Logic"} by ShipCopy._`);
  return parts.join("\n\n") + "\n";
}

export function regeneratePrompt(basePrompt, { key, label, limit, current = {} } = {}) {
  return `${basePrompt}

CURRENT DRAFT (JSON): ${JSON.stringify(current)}

TASK: Write a NEW, clearly different version of ONLY the "${key}" field (${label}, under ${limit} characters). Same facts, same tone, no invented features. Return the full JSON object with every other field copied unchanged.`;
}

export const HISTORY_KEY = "shipcopy.history.v1";
export const HISTORY_MAX = 10;

export function loadHistory(storage) {
  try { const v = JSON.parse(storage.getItem(HISTORY_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; }
}

export function addHistory(storage, entry, { max = HISTORY_MAX, now = Date.now() } = {}) {
  const item = { id: String(now), at: now, ...entry };
  const list = [item, ...loadHistory(storage).filter(h => !(h.product === item.product && h.version === item.version && JSON.stringify(h.data) === JSON.stringify(item.data)))].slice(0, max);
  try { storage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (_) { /* quota / private mode: history is best-effort */ }
  return list;
}

export function updateHistory(storage, id, patch) {
  const list = loadHistory(storage).map(h => h.id === id ? { ...h, ...patch } : h);
  try { storage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (_) {}
  return list;
}

export function clearHistory(storage) { try { storage.removeItem(HISTORY_KEY); } catch (_) {} return []; }

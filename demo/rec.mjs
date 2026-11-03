// Captioned screen recording of the LIVE ShipCopy app via headless Chrome + CDP (strategist s34).
// usage: node rec.mjs <url> <outdir> <steps.json>
// steps: {"wait":ms} | {"eval":"js"} | {"cap":"caption text"|""} | {"until":"js expr","timeout":ms} | {"offline":true|false}
// The CDP port is OS-picked (--remote-debugging-port=0 + DevToolsActivePort), so it never collides with other agents.
import { spawn } from "node:child_process";
import fs from "node:fs";
const [url, out, stepsPath] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
fs.mkdirSync(out, { recursive: true });
const W = 1280, H = 720;
const prof = "/tmp/shipcopy-rec-" + Date.now();
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--remote-debugging-port=0", `--window-size=${W},${H}`, "--user-data-dir=" + prof,
   "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let port;
for (let i = 0; i < 100 && !port; i++) { try { port = fs.readFileSync(prof + "/DevToolsActivePort", "utf8").split("\n")[0]; } catch {} await sleep(100); }
let ws;
for (let i = 0; i < 50 && !ws; i++) { try { const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === "page" && x.url === "about:blank"); if (t) ws = new WebSocket(t.webSocketDebuggerUrl); } catch {} await sleep(200); }
console.error("port", port, !!ws); if (ws.readyState !== 1) await new Promise(r => ws.onopen = r); console.error("ws open");
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); }
  if (d.method === "Runtime.consoleAPICalled") logs.push(d.params.type + ": " + d.params.args.map(a => a.value ?? a.description ?? "").join(" ")); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Page.navigate", { url });
await sleep(3000); console.error("navigated");
const CAP = `(t)=>{let c=document.getElementById('__cap');if(!c){c=document.createElement('div');c.id='__cap';c.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1100px;background:rgba(10,12,20,.88);color:#fff;font:600 22px/1.35 system-ui,sans-serif;padding:12px 22px;border-radius:12px;z-index:99999;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)';document.body.appendChild(c);}c.textContent=t;c.style.display=t?'block':'none';}`;
let n = 0; const t0 = Date.now(); const times = []; let recording = true;
const rec = (async () => { while (recording) { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 }); if (r?.data) { fs.writeFileSync(`${out}/f${String(n).padStart(5, "0")}.jpg`, Buffer.from(r.data, "base64")); times.push(Date.now() - t0); n++; } await sleep(60); } })();
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.cap !== undefined) await ev(`(${CAP})(${JSON.stringify(s.cap)})`);
  if (s.eval) await ev(s.eval);
  if (s.offline !== undefined) { await send("Network.emulateNetworkConditions", { offline: s.offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await ev(`window.dispatchEvent(new Event(${s.offline ? "'offline'" : "'online'"}))`); }
  if (s.until) { const end = Date.now() + (s.timeout || 30000); let ok = false; while (Date.now() < end) { if (await ev(s.until)) { ok = true; break; } await sleep(250); } console.error("until", ok ? "OK" : "TIMEOUT", s.until.slice(0, 60)); }
}
recording = false; await rec;
let list = ""; for (let i = 0; i < n; i++) { const d = ((times[i + 1] ?? times[i] + 100) - times[i]) / 1000; list += `file 'f${String(i).padStart(5, "0")}.jpg'\nduration ${d.toFixed(3)}\n`; }
list += `file 'f${String(n - 1).padStart(5, "0")}.jpg'\n`;
fs.writeFileSync(`${out}/list.txt`, list);
fs.writeFileSync(`${out}/console.log`, logs.join("\n"));
console.log(JSON.stringify({ frames: n, seconds: times[n - 1] / 1000 }));
ws.close(); chrome.kill();

import test from "node:test";
import assert from "node:assert/strict";
import { parseRepo, commitLine, nextVersion, importSinceLastRelease } from "../github.js";

test("parseRepo accepts slugs and URLs", () => {
  assert.deepEqual(parseRepo("sindresorhus/ky"), { owner: "sindresorhus", repo: "ky" });
  assert.deepEqual(parseRepo("https://github.com/vercel/next.js.git"), { owner: "vercel", repo: "next.js" });
  assert.deepEqual(parseRepo("github.com/a-b/c_d/tree/main/src"), { owner: "a-b", repo: "c_d" });
  assert.equal(parseRepo("not a repo"), null);
  assert.equal(parseRepo(""), null);
});

test("commitLine: first line, PR title for merges, drops branch merges", () => {
  assert.equal(commitLine("fix: crash on BOM\n\nlong body"), "fix: crash on BOM");
  assert.equal(commitLine("Merge pull request #42 from x/feat\n\nAdd dark mode"), "Add dark mode (#42)");
  assert.equal(commitLine("Merge branch 'main' into feat"), "");
  assert.equal(commitLine("Merge pull request #7 from x/y\n\nSigned-off-by: a"), "");
  for (const m of ["2.2.0", "v1.4.0", "Release 1.4.0", "chore(release): 1.4.0-beta.1", "Bump version to 3.0"]) assert.equal(commitLine(m), "", m);
  assert.equal(commitLine("Support Node 22.1.0 streams"), "Support Node 22.1.0 streams");
});

test("nextVersion bumps patch, keeps odd formats", () => {
  assert.equal(nextVersion("v2.4.1"), "2.4.2");
  assert.equal(nextVersion("1.0.0"), "1.0.1");
  assert.equal(nextVersion("v1.0.0-beta.2"), "after v1.0.0-beta.2");
  assert.equal(nextVersion(""), "");
});

function mockFetch(routes) {
  const calls = [];
  const f = async (url) => {
    calls.push(url.replace("https://api.github.com", ""));
    const key = Object.keys(routes).find(k => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const v = routes[key];
    if (typeof v === "number") return { ok: false, status: v, headers: { get: () => "1700000000" }, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => v };
  };
  f.calls = calls;
  return f;
}
const C = m => ({ commit: { message: m } });

test("import: latest release -> compare against default branch, newest first, deduped", async () => {
  const f = mockFetch({
    "/repos/o/app": { name: "app", default_branch: "trunk" },
    "/repos/o/app/releases/latest": { tag_name: "v1.2.3" },
    "/repos/o/app/compare/v1.2.3...trunk": { total_commits: 4, commits: [C("feat: a"), C("fix: b"), C("fix: b"), C("Merge branch 'x'")] },
  });
  const r = await importSinceLastRelease("o/app", { fetch: f });
  assert.equal(r.base, "v1.2.3"); assert.equal(r.version, "1.2.4"); assert.equal(r.product, "app");
  assert.deepEqual(r.lines, ["fix: b", "feat: a"]);
  assert.equal(r.total, 4);
  assert.equal(f.calls.length, 3);
});

test("import: no releases -> newest tag", async () => {
  const f = mockFetch({
    "/repos/o/app": { name: "app", default_branch: "main" },
    "/repos/o/app/tags?per_page=1": [{ name: "0.9.0" }],
    "/repos/o/app/compare/0.9.0...main": { commits: [C("feat: x")] },
  });
  const r = await importSinceLastRelease("https://github.com/o/app", { fetch: f });
  assert.equal(r.base, "0.9.0"); assert.deepEqual(r.lines, ["feat: x"]);
});

test("import: no tags at all -> last N commits", async () => {
  const f = mockFetch({
    "/repos/o/app": { name: "app", default_branch: "main" },
    "/repos/o/app/tags?per_page=1": [],
    "/repos/o/app/commits?sha=main&per_page=30": [C("b"), C("a")],
  });
  const r = await importSinceLastRelease("o/app", { fetch: f });
  assert.equal(r.base, null); assert.deepEqual(r.lines, ["b", "a"]); assert.equal(r.version, "");
});

test("import: explicit since tag skips release lookup; bad tag errors", async () => {
  const f = mockFetch({ "/repos/o/app": { name: "app", default_branch: "main" } });
  await assert.rejects(importSinceLastRelease("o/app", { fetch: f, sinceTag: "v9" }), /Tag "v9" not found/);
  assert.ok(!f.calls.some(c => c.includes("releases")));
});

test("import: errors for missing repo, rate limit, bad input; truncation", async () => {
  await assert.rejects(importSinceLastRelease("o/nope", { fetch: mockFetch({}) }), /not found/);
  await assert.rejects(importSinceLastRelease("o/app", { fetch: mockFetch({ "/repos/o/app": 403 }) }), /rate limit/);
  await assert.rejects(importSinceLastRelease("???", { fetch: mockFetch({}) }), /owner\/repo/);
  const many = Array.from({ length: 100 }, (_, i) => C("c" + i));
  const f = mockFetch({
    "/repos/o/app": { name: "app", default_branch: "main" },
    "/repos/o/app/releases/latest": { tag_name: "1.0.0" },
    "/repos/o/app/compare/1.0.0...main": { commits: many },
  });
  const r = await importSinceLastRelease("o/app", { fetch: f, maxLines: 10 });
  assert.equal(r.lines.length, 10); assert.ok(r.truncated); assert.equal(r.lines[0], "c99");
});

test("import: nothing since latest release -> describe that release (prev tag...release)", async () => {
  const f = mockFetch({
    "/repos/o/app": { name: "app", default_branch: "main" },
    "/repos/o/app/releases/latest": { tag_name: "v2.0.0" },
    "/repos/o/app/compare/v2.0.0...main": { total_commits: 0, commits: [] },
    "/repos/o/app/tags?per_page=30": [{ name: "v2.0.0" }, { name: "v1.9.0" }],
    "/repos/o/app/compare/v1.9.0...v2.0.0": { commits: [C("feat: big thing")] },
  });
  const r = await importSinceLastRelease("o/app", { fetch: f });
  assert.equal(r.base, "v1.9.0"); assert.equal(r.head, "v2.0.0"); assert.equal(r.version, "2.0.0");
  assert.deepEqual(r.lines, ["feat: big thing"]);
});

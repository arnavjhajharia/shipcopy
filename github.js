// github.js — import "what changed since the last release" from a public GitHub repo.
// Pure module: fetch is injected, so it runs in the browser and in node --test with a mock.
// Uses the unauthenticated GitHub REST API (60 requests/hour per IP; an import costs 3).

const API = "https://api.github.com";

/** Accepts "owner/repo", "https://github.com/owner/repo(.git)(/anything)", "github.com/owner/repo". */
export function parseRepo(input) {
  const s = String(input || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/** One changelog line per commit: PR title for merge commits, first line otherwise; drops noise. */
export function commitLine(message) {
  const lines = String(message || "").split("\n").map(l => l.trim());
  let first = lines[0] || "";
  const merge = first.match(/^Merge pull request #(\d+) from \S+/);
  if (merge) {
    const title = lines.slice(1).find(l => l && !/^(co-authored-by|signed-off-by):/i.test(l));
    first = title ? `${title} (#${merge[1]})` : "";
  }
  if (/^Merge (branch|remote-tracking branch) /.test(first)) return "";
  // Release-bookkeeping commits carry no user-facing change: "2.2.0", "v1.4.0", "Release 1.4.0", "chore(release): 1.4.0".
  if (/^(?:(?:chore\(release\):|release|bump version(?: to)?|version)\s*)?v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?$/i.test(first)) return "";
  return first;
}

/** Suggests the next version after a tag: v2.4.1 -> 2.4.2. Keeps unknown formats as "after <tag>". */
export function nextVersion(tag) {
  if (!tag) return "";
  const m = String(tag).match(/^(.*?)(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m || m[5]) return `after ${tag}`;
  return `${m[2]}.${m[3]}.${Number(m[4]) + 1}`;
}

async function getJSON(fetchFn, url) {
  const res = await fetchFn(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) return { notFound: true };
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers?.get?.("x-ratelimit-reset");
    const when = reset ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString()}.` : "";
    throw new Error(`GitHub rate limit reached (60 requests/hour without login).${when}`);
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url.replace(API, "")}`);
  return { data: await res.json() };
}

/**
 * Returns { owner, repo, product, base, head, version, lines, total, truncated, changelog }.
 * base = latest release tag (or newest tag); with no tags, the last `fallbackCount` commits.
 * If nothing landed since the latest release, describes that release instead (previous tag...release tag).
 */
export async function importSinceLastRelease(input, { fetch: fetchFn = globalThis.fetch, sinceTag = "", fallbackCount = 30, maxLines = 80 } = {}) {
  const r = parseRepo(input);
  if (!r) throw new Error('Enter a public repo as "owner/repo" or a github.com URL.');
  const base = `${API}/repos/${r.owner}/${r.repo}`;

  const meta = await getJSON(fetchFn, base);
  if (meta.notFound) throw new Error(`Repo ${r.owner}/${r.repo} not found (private repos aren't supported).`);
  const branch = meta.data.default_branch || "main";
  const product = meta.data.name || r.repo;

  let tag = sinceTag.trim();
  let releasedTag = null; // set when we describe an already-tagged release
  if (!tag) {
    const rel = await getJSON(fetchFn, `${base}/releases/latest`);
    if (!rel.notFound && rel.data?.tag_name) tag = rel.data.tag_name;
    else {
      const tags = await getJSON(fetchFn, `${base}/tags?per_page=1`);
      if (!tags.notFound && tags.data?.length) tag = tags.data[0].name;
    }
  }

  let commits, total;
  if (tag) {
    const cmp = await getJSON(fetchFn, `${base}/compare/${encodeURIComponent(tag)}...${encodeURIComponent(branch)}`);
    if (cmp.notFound) throw new Error(`Tag "${tag}" not found in ${r.owner}/${r.repo}.`);
    commits = cmp.data.commits || [];
    total = cmp.data.total_commits ?? commits.length;
    if (!commits.length && !sinceTag.trim()) {
      // Nothing since the latest release: the user most likely just tagged it, so describe THAT release.
      const tags = await getJSON(fetchFn, `${base}/tags?per_page=30`);
      const names = (tags.data || []).map(t => t.name);
      const prev = names[names.indexOf(tag) + 1];
      if (names.includes(tag) && prev) {
        const rel = await getJSON(fetchFn, `${base}/compare/${encodeURIComponent(prev)}...${encodeURIComponent(tag)}`);
        commits = rel.data?.commits || [];
        total = rel.data?.total_commits ?? commits.length;
        releasedTag = tag; tag = prev;
      }
    }
    commits = commits.slice().reverse(); // newest first, like git log
  } else {
    const list = await getJSON(fetchFn, `${base}/commits?sha=${encodeURIComponent(branch)}&per_page=${fallbackCount}`);
    commits = list.data || [];
    total = commits.length;
  }

  const seen = new Set();
  const lines = [];
  for (const c of commits) {
    const l = commitLine(c.commit?.message);
    if (!l || seen.has(l)) continue;
    seen.add(l); lines.push(l);
  }
  const truncated = lines.length > maxLines;
  const kept = lines.slice(0, maxLines);
  return {
    owner: r.owner, repo: r.repo, product, branch, base: tag || null, head: releasedTag || branch,
    version: releasedTag ? releasedTag.replace(/^v(?=\d)/, "") : nextVersion(tag), lines: kept, total, truncated,
    changelog: kept.join("\n"),
  };
}

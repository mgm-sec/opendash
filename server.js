// server.js — openDash: static files + /rss and /ping proxies. Zero dependencies.
// Run via Docker (see docker-compose.yml). Node 18+ for built-in fetch.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT       = process.env.PORT || 8151;
const ROOT       = __dirname;
const TIMEOUT_MS = 8000;
const MAX_BYTES  = 512 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

// Loose enough for Open-Meteo, user-set background images, and the scratchpad iframe.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src * data:; connect-src *; frame-src *",
};

// ── /rss?url=<encoded> — RSS/Atom CORS proxy ──────────────
// ponytail: open proxy by design (homelab use) — don't expose to the internet.
async function rss(u, res) {
  const feedUrl = u.searchParams.get("url");
  if (!feedUrl || !/^https?:\/\//.test(feedUrl)) {
    res.writeHead(400); res.end("Bad url param"); return;
  }
  try {
    const upstream = await fetch(feedUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // Stream with a hard cap — never buffer an unbounded upstream body.
    const reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
    }
    reader.cancel().catch(() => {});
    res.writeHead(upstream.status, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "max-age=180",
    });
    res.end(Buffer.concat(chunks).subarray(0, MAX_BYTES));
  } catch (e) {
    if (e.name === "TimeoutError") { res.writeHead(504); res.end("Timeout"); }
    else { res.writeHead(502); res.end("Fetch failed"); }
  }
}

// ── /ping?url=<encoded> — service health check ────────────
// ponytail: can reach private IPs on purpose (that's the point of the widget).
async function ping(u, res) {
  const target = u.searchParams.get("url");
  res.setHeader("Content-Type", "application/json");
  if (!target || !/^https?:\/\//.test(target)) {
    res.end(JSON.stringify({ ok: false, status: 0, ms: 0, error: "bad url" })); return;
  }
  const start = Date.now();
  try {
    const r = await fetch(target, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
    res.end(JSON.stringify({ ok: r.status < 400, status: r.status, ms: Date.now() - start }));
  } catch (e) {
    const error = e.name === "TimeoutError" ? "timeout" : "unreachable";
    res.end(JSON.stringify({ ok: false, status: 0, ms: Date.now() - start, error }));
  }
}

// ── Static files ──────────────────────────────────────────
function serveStatic(u, res) {
  const rel = decodeURIComponent(u.pathname) === "/" ? "index.html" : decodeURIComponent(u.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, "index.html")) {
    res.writeHead(403); res.end("Forbidden"); return; // path-traversal guard
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }); res.end("Method not allowed"); return;
  }
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/rss")  return rss(u, res);
  if (u.pathname === "/ping") return ping(u, res);
  serveStatic(u, res);
}).listen(PORT, () => console.log(`openDash → http://localhost:${PORT}`));

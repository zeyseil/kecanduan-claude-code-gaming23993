// Thin HTTP wrapper around the Komikcast scraper.
// Endpoints return raw parsed data; "find next chapter" logic lives in the
// komik-tracker Worker (not here), matching the kiryuu/komiku resolvers.
import express from "express";
import { search, chapters } from "./komikcast.js";
import { closeBrowser } from "./browser.js";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const SECRET = process.env.SCRAPER_SECRET || "";

// Optional shared-secret guard. If SCRAPER_SECRET is set, every endpoint except
// /health requires header `X-Scraper-Secret` to match. Keeps a public Render URL
// from being abused as a free Cloudflare bypass by strangers.
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  if (req.get("X-Scraper-Secret") === SECRET) return next();
  return res.status(401).json({ error: "unauthorized" });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/search", requireSecret, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "missing q" });
  try {
    const results = await search(q);
    res.json({ results });
  } catch (err) {
    console.error("search failed:", err?.message || err);
    res.status(502).json({ error: "scrape_failed", detail: String(err?.message || err) });
  }
});

app.get("/chapters", requireSecret, async (req, res) => {
  const slug = String(req.query.slug || "").trim();
  if (!slug) return res.status(400).json({ error: "missing slug" });
  try {
    const results = await chapters(slug);
    res.json({ chapters: results });
  } catch (err) {
    console.error("chapters failed:", err?.message || err);
    res.status(502).json({ error: "scrape_failed", detail: String(err?.message || err) });
  }
});

const server = app.listen(PORT, () => {
  console.log(`komikcast-scraper listening on :${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close();
  await closeBrowser();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Komikcast scraping via headless browser (patchright) so Cloudflare's
// JS-challenge is solved by a real Chromium, not defeated by cheerio.
//
// SELECTORS ARE BEST-EFFORT and version-dependent — Komikcast redesigns/renames
// its domain often. They MUST be re-verified against the live site after deploy
// (see README). Base domain is overridable via KOMIKCAST_BASE_URL for when the
// domain rotates (v3.komikcast.fit → next).
import { withPage } from "./browser.js";

const DEFAULT_BASE = "https://v3.komikcast.fit";

export function base() {
  return (process.env.KOMIKCAST_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS || 45000);

// Navigate and give Cloudflare's challenge time to resolve. We wait for the DOM
// to contain real content (a known selector) rather than the interstitial.
async function gotoAndSettle(page, url, readySelector) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  // Cloudflare interstitial title is "Just a moment...". Wait until either the
  // ready selector appears or we time out (challenge failed / structure changed).
  try {
    await page.waitForSelector(readySelector, { timeout: NAV_TIMEOUT });
  } catch {
    // Fall through — caller inspects what (if anything) was parsed.
  }
}

// GET /search?q= → [{ title, slug }]
// slug = the manga path segment used to build the detail URL.
export async function search(query) {
  const url = `${base()}/?s=${encodeURIComponent(query)}`;
  return withPage(async (page) => {
    await gotoAndSettle(page, url, ".list-update_item, .list-update_item-image");
    return page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll(".list-update_item")
      );
      const out = [];
      for (const el of items) {
        const a = el.querySelector("a[href]");
        const titleEl = el.querySelector(".title, h3, h4");
        const href = a?.getAttribute("href") || "";
        const title = (titleEl?.textContent || a?.getAttribute("title") || "").trim();
        if (!href || !title) continue;
        // slug = last non-empty path segment of the manga URL
        const m = href.replace(/\/+$/, "").match(/\/([^/]+)$/);
        const slug = m ? m[1] : "";
        if (!slug) continue;
        out.push({ title, slug });
      }
      return out;
    });
  });
}

// GET /chapters?slug= → [{ chapterNumber, url }] (full list, unsorted).
// The Worker will pick the "next" chapter (argmin > afterChapter) itself,
// consistent with the existing kiryuu/komiku resolvers.
export async function chapters(slug) {
  const url = `${base()}/komik/${encodeURIComponent(slug)}/`;
  return withPage(async (page) => {
    await gotoAndSettle(page, url, ".komik_info-chapters, .chapter-link-item, li a[href*='chapter']");
    return page.evaluate(() => {
      const anchors = Array.from(
        document.querySelectorAll(
          ".komik_info-chapters a[href], .chapter-link-item, li a[href*='chapter']"
        )
      );
      const out = [];
      const seen = new Set();
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        if (!href || seen.has(href)) continue;
        const text = (a.textContent || "").trim();
        // chapter number: prefer the URL (…-chapter-179 / …chapter-179.6),
        // fall back to the visible text ("Chapter 179").
        const fromUrl = href.match(/chapter-(\d+(?:[.-]\d+)?)/i);
        const fromText = text.match(/chapter\s*(\d+(?:\.\d+)?)/i);
        const raw = (fromUrl?.[1] || fromText?.[1] || "").replace(/-/g, ".");
        const chapterNumber = Number(raw);
        if (!Number.isFinite(chapterNumber)) continue;
        seen.add(href);
        out.push({ chapterNumber, url: href });
      }
      return out;
    });
  });
}

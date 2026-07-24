// Komikcast (Indonesian, general-catalog manga/manhwa/manhua site) lookup via
// Cloudflare Browser Rendering — see plan history / CLAUDE.md for why: a plain
// fetch() to v3.komikcast.fit returns 403 (Cloudflare bot-challenge), and a
// prior attempt to run a separate Playwright scraper on Render was abandoned
// after repeated card-verification failures on Render's side (unrelated to
// this code). Browser Rendering runs the headless Chromium INSIDE this
// Worker's own Cloudflare account instead — no third-party platform, no card.
//
// UNVERIFIED AT WRITE TIME (documented honestly, not a guarantee):
//   - Whether Komikcast's Cloudflare challenge actually lets Browser Rendering
//     traffic through. Cloudflare's own docs say Browser Rendering requests
//     "will always be identified as a bot" — this could go either way (real
//     Chromium that solves JS challenges vs. a target site's Bot Management
//     specifically flagging Cloudflare-to-Cloudflare origin). Only a live
//     deploy + curl can prove this either way.
//   - The CSS selectors below (`.list-update_item`, `.komik_info-chapters`,
//     etc.) are a best-effort guess at Komikcast's WordPress-manga-theme
//     markup, ported from the earlier Render scaffold — NOT verified against
//     the live site (the site itself blocks the plain fetches this session's
//     tooling could use to check). Re-verify after deploy; expect to need to
//     adjust these.
//
// Selector strategy mirrors kiryuu.ts's argmin approach: no attempt to trust
// document order for "closest chapter above afterChapter" (see
// komikcastChapters.ts) — same reasoning as Kiryuu's stray quick-link problem
// could plausibly also apply here.

import type { Env } from "../env";
import { withBrowserPage } from "./browserRendering";
import { pickBestTitleMatch } from "./titleMatch";

// page.evaluate() callbacks below run inside the rendered browser page, a
// different JS realm than this Worker's own runtime — tsconfig's `lib`
// (ES2022 only, no "dom") has no DOM types for that realm. These ambient
// declarations are just enough to typecheck the callbacks; they're never
// invoked in the Worker's own context.
declare const document: {
  querySelectorAll(selector: string): Iterable<{
    querySelector(selector: string): { getAttribute(name: string): string | null; textContent: string | null } | null;
  }>;
};

const DEFAULT_BASE = "https://v3.komikcast.fit";

export interface KomikcastMatch {
  title: string;
  /** Manga path segment, e.g. "solo-leveling" — used to build the detail URL. */
  slug: string;
}

/** Base host resolution — Komikcast rotates domains often, so it's
 * overridable via env like Kiryuu's versioned domain. */
export function komikcastBase(env: Env): string {
  return (env.KOMIKCAST_API_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

interface RawSearchEntry {
  title: string;
  slug: string;
}

/**
 * Searches Komikcast by title (rendered via a real headless browser to clear
 * any Cloudflare challenge) and returns the best-matching result, or null if
 * navigation fails or no candidate passes the shared title-match acceptance
 * rule (lib/titleMatch.ts, same gate used by every other source).
 */
export async function searchKomikcastMatch(title: string, env: Env): Promise<KomikcastMatch | null> {
  const base = komikcastBase(env);
  const url = `${base}/?s=${encodeURIComponent(title)}`;

  let entries: RawSearchEntry[];
  try {
    entries = await withBrowserPage(env, async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      return page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".list-update_item"));
        const out: { title: string; slug: string }[] = [];
        for (const el of items) {
          const a = el.querySelector("a[href]");
          const titleEl = el.querySelector(".title, h3, h4");
          const href = a?.getAttribute("href") || "";
          const entryTitle = (titleEl?.textContent || a?.getAttribute("title") || "").trim();
          if (!href || !entryTitle) continue;
          const m = href.replace(/\/+$/, "").match(/\/([^/]+)$/);
          const slug = m ? m[1] : "";
          if (!slug) continue;
          out.push({ title: entryTitle, slug });
        }
        return out;
      });
    });
  } catch (err) {
    console.error(`searchKomikcastMatch: browser navigation failed for "${title}": ${String(err)}`);
    return null;
  }

  if (entries.length === 0) {
    console.error(`searchKomikcastMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, (e) => [e.title]);
  if (!match) {
    console.error(`searchKomikcastMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}

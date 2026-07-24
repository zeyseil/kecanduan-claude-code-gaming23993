// "Cari link chapter berikutnya" via Komikcast — see komikcast.ts for why this
// source goes through Cloudflare Browser Rendering instead of a plain fetch().
//
// Like Kiryuu, the chapter list is scraped from raw HTML (no JSON API), and
// selector markup is unverified against the live site (see komikcast.ts).
// We use the same argmin strategy as Kiryuu rather than a descending-stop scan
// (used by comick/Shinigami/Komiku, which get a clean single-purpose list from
// a real API): without having verified the list order/noise live, argmin is
// the safer default — it's correct regardless of ordering, at the cost of no
// early-exit optimization. Revisit if/when the site's actual markup is
// confirmed live and proven clean.

import type { Env } from "../env";
import type { NextChapterResult } from "./comickChapters";
import { komikcastBase, searchKomikcastMatch } from "./komikcast";
import { withBrowserPage } from "./browserRendering";
import { acquireKomikcastSlot } from "../durable-objects/RateLimiter";

// See the matching ambient declaration in komikcast.ts for why this is
// needed: page.evaluate() runs in the browser page's own JS realm, which this
// Worker's tsconfig (`lib`: ES2022 only) has no DOM types for.
declare const document: {
  querySelectorAll(selector: string): Iterable<{
    getAttribute(name: string): string | null;
    textContent: string | null;
  }>;
};

interface ParsedChapterLink {
  chapterNumber: number;
  href: string;
}

/**
 * Finds the chapter right after `afterChapter` for `title` on Komikcast and
 * returns its reader URL. Never persists anything itself — callers decide
 * whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrlKomikcast(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireKomikcastSlot(env.RATE_LIMITER);
  const match = await searchKomikcastMatch(title, env);
  if (!match) {
    return { read_url: null, reason: "Komik tidak ditemukan di Komikcast" };
  }

  await acquireKomikcastSlot(env.RATE_LIMITER);
  const base = komikcastBase(env);
  const detailUrl = `${base}/komik/${encodeURIComponent(match.slug)}/`;

  let links: ParsedChapterLink[];
  try {
    links = await withBrowserPage(env, async (page) => {
      await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      return page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll(
            ".komik_info-chapters a[href], .chapter-link-item, li a[href*='chapter']",
          ),
        );
        const out: { chapterNumber: number; href: string }[] = [];
        const seen = new Set<string>();
        for (const a of anchors) {
          const href = a.getAttribute("href") || "";
          if (!href || seen.has(href)) continue;
          const text = (a.textContent || "").trim();
          const fromUrl = href.match(/chapter-(\d+(?:[.-]\d+)?)/i);
          const fromText = text.match(/chapter\s*(\d+(?:\.\d+)?)/i);
          const raw = (fromUrl?.[1] || fromText?.[1] || "").replace(/-/g, ".");
          const chapterNumber = Number(raw);
          if (!Number.isFinite(chapterNumber)) continue;
          seen.add(href);
          out.push({ chapterNumber, href });
        }
        return out;
      });
    });
  } catch (err) {
    console.error(`findNextChapterUrlKomikcast: browser navigation failed for "${detailUrl}": ${String(err)}`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Komikcast" };
  }

  // Argmin (same reasoning as kiryuuChapters.ts): scan the whole list and keep
  // the smallest chapter number still greater than afterChapter, rather than
  // trusting document order.
  let best: ParsedChapterLink | null = null;
  for (const link of links) {
    if (link.chapterNumber <= afterChapter) continue;
    if (!best || link.chapterNumber < best.chapterNumber) {
      best = link;
    }
  }

  if (!best) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komikcast" };
  }
  return { read_url: best.href };
}

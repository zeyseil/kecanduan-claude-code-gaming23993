// Thin wrapper around Cloudflare Browser Rendering (@cloudflare/puppeteer).
// Used ONLY by lib/komikcast.ts — every other chapter/cover source is a plain
// fetch() against a JSON API or server-rendered HTML that doesn't need a real
// browser. This exists because Komikcast is (or may be) behind a Cloudflare
// bot-challenge that a bare fetch() can't solve; a real headless Chromium can.
//
// The Free-plan quota is tight (10 browser-minutes/day, 3 concurrent browsers,
// docs.cloudflare.com/browser-rendering/platform/limits/) — every page opened
// here MUST be closed promptly, so `withBrowserPage` always closes the browser
// in a `finally`, even on error. Callers additionally rate-limit via
// acquireKomikcastSlot before calling this (see komikcastChapters.ts).
import puppeteer, { type Page } from "@cloudflare/puppeteer";
import type { Env } from "../env";

// Passed explicitly to each page.goto() call rather than relying on a
// "set default timeout" method, since @cloudflare/puppeteer is a trimmed fork
// of puppeteer-core and its exact method surface hasn't been hand-verified.
export const NAV_TIMEOUT_MS = 45000;

/**
 * Launches a browser, opens one page, runs `fn(page)`, and always closes the
 * browser afterwards. Never reuses a session across calls — the quota is too
 * small to make session pooling worthwhile for this feature's traffic.
 */
export async function withBrowserPage<T>(env: Env, fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close().catch(() => {});
  }
}

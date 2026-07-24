// Singleton headless browser. Launched once, reused across requests.
// A fresh page (not a fresh browser) is opened per request and closed after,
// to keep memory bounded on Render's tiny free tier (512MB).
import { chromium } from "patchright";

let browserPromise = null;

// Memory-conscious flags. `--disable-dev-shm-usage` is critical in Docker:
// the default /dev/shm is 64MB and Chromium's render pipeline overruns it → crash.
// `--single-process` trades stability for lower RAM; toggle off via env if it crashes.
function launchArgs() {
  const args = [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-setuid-sandbox",
    "--no-zygote",
    "--disable-extensions",
    "--disable-background-networking",
  ];
  if (process.env.SINGLE_PROCESS !== "false") {
    args.push("--single-process");
  }
  return args;
}

async function launch() {
  const browser = await chromium.launch({
    headless: true,
    args: launchArgs(),
  });
  // If the browser dies (crash/OOM), drop the cached promise so the next
  // request relaunches instead of reusing a dead handle.
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

// Open a page, run `fn(page)`, always close the page afterwards.
export async function withPage(fn) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close().catch(() => {});
  } finally {
    browserPromise = null;
  }
}

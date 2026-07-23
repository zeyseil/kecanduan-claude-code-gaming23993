import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import type { Comic } from "../types/comic";
import { getAuthToken } from "./storage";

/** Stable label so re-clicking "Lanjutkan Membaca" reuses/refocuses the same
 * companion window instead of spawning duplicates — only one comic's reading
 * session is realistically active at a time. */
export const FLOATING_READER_LABEL = "floating-reader";

/** Event the companion window emits after a successful chapter update, so the
 * main window can merge it into its own `comics` state without a refetch. */
export const COMIC_UPDATED_EVENT = "komik-tracker://comic-updated";

/** Event the main window emits to an already-open companion window so it
 * switches to a different comic instead of spawning a duplicate window. */
export const FLOATING_READER_SET_COMIC_EVENT = "komik-tracker://floating-reader-set-comic";

export interface FloatingReaderComicPayload {
  comicId: string;
  title: string;
  latestChapter: number;
}

function toPayload(comic: Comic): FloatingReaderComicPayload {
  return { comicId: comic.comic_id, title: comic.title, latestChapter: comic.latest_chapter };
}

function floatingReaderUrl(comic: Comic): string {
  // Token passed as a safe fallback for the companion window's auth — Tauri
  // windows on Windows/macOS share localStorage in practice (same WebView2
  // profile), but this degrades gracefully if that ever isn't true. Safe here
  // because this is a local hash-route URL, never sent over the network.
  const token = getAuthToken() ?? "";
  // title/latestChapter riding along so the window can render immediately
  // without its own fetchComics() round trip (was the whole-list fetch that
  // made the window feel slow to appear) — comicId is still the source of
  // truth for the PATCH call itself.
  const params = new URLSearchParams({
    comicId: comic.comic_id,
    title: comic.title,
    latestChapter: String(comic.latest_chapter),
    token,
  });
  // App uses HashRouter under Tauri (see main.tsx) — the route lives AFTER
  // the `#`. A plain "/floating-reader" path (no hash) resolves to hash="" on
  // load, which HashRouter treats as "/" — the companion window would render
  // the full Shell/DaftarKomik instead of FloatingReader. Loading
  // "index.html" explicitly (rather than "/") also avoids relying on the
  // custom-protocol root resolving to it implicitly.
  return `index.html#/floating-reader?${params.toString()}`;
}

/**
 * Opens the always-on-top reading companion window for `comic`, or — if one
 * is already open — focuses it and tells it to switch to this comic instead
 * of creating a duplicate window.
 */
export async function openOrFocusFloatingReader(comic: Comic): Promise<void> {
  const existing = await WebviewWindow.getByLabel(FLOATING_READER_LABEL);
  if (existing) {
    await emit(FLOATING_READER_SET_COMIC_EVENT, toPayload(comic));
    await existing.setFocus();
    return;
  }

  new WebviewWindow(FLOATING_READER_LABEL, {
    url: floatingReaderUrl(comic),
    title: "Sedang Membaca",
    width: 300,
    height: 200,
    resizable: false,
    alwaysOnTop: true,
    focus: true,
  });
}

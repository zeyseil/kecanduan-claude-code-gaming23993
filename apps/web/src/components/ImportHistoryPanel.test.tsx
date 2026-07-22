import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { logImportEvent } from "../lib/importHistory";

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImportHistoryPanel", () => {
  it("menampilkan pesan kosong kalau belum ada riwayat", () => {
    render(<ImportHistoryPanel />);
    expect(screen.getByText(/belum ada riwayat impor/i)).toBeInTheDocument();
  });

  it("menampilkan maksimal 3 entri terbaru dengan ikon status", () => {
    logImportEvent({ status: "success", message: "12 Komik" });
    logImportEvent({ status: "error", message: "Parsing Eror Baris 14" });
    logImportEvent({ status: "success", message: "3 Komik" });
    logImportEvent({ status: "success", message: "1 Komik" });

    render(<ImportHistoryPanel />);

    expect(screen.getByText(/1 komik/i)).toBeInTheDocument();
    expect(screen.getByText(/3 komik/i)).toBeInTheDocument();
    expect(screen.getByText(/parsing eror baris 14/i)).toBeInTheDocument();
    expect(screen.queryByText(/12 komik/i)).not.toBeInTheDocument();
  });
});

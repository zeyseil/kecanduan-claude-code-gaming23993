import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthToken,
  getAuthToken,
  getGoogleApiKey,
  getSafeMode,
  setAuthToken,
  setGoogleApiKey,
  setSafeMode,
} from "./storage";

// jsdom's built-in localStorage is unreliable under some Node versions in
// this environment, so we stub it ourselves (same pattern as fetch mocking
// elsewhere) rather than depend on the real browser implementation.
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

describe("google api key storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty string when nothing stored", () => {
    expect(getGoogleApiKey()).toBe("");
  });

  it("persists and reads back a value", () => {
    setGoogleApiKey("AIzaSomeKey");
    expect(getGoogleApiKey()).toBe("AIzaSomeKey");
  });

  it("clears storage when set to empty string", () => {
    setGoogleApiKey("AIzaSomeKey");
    setGoogleApiKey("");
    expect(getGoogleApiKey()).toBe("");
  });
});

describe("auth token storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing stored", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("persists and reads back a token", () => {
    setAuthToken("my-token");
    expect(getAuthToken()).toBe("my-token");
  });

  it("clears the token", () => {
    setAuthToken("my-token");
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});

describe("safe mode storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to ON (true) when nothing stored", () => {
    expect(getSafeMode()).toBe(true);
  });

  it("persists OFF and reads it back as false", () => {
    setSafeMode(false);
    expect(getSafeMode()).toBe(false);
  });

  it("persists ON again after being turned off", () => {
    setSafeMode(false);
    setSafeMode(true);
    expect(getSafeMode()).toBe(true);
  });
});

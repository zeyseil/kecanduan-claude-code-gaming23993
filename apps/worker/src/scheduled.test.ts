import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { scheduled } from "./scheduled";
import * as comicStore from "./store/comicStore";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
    ASTRA_DB_APPLICATION_TOKEN: "fake-token",
    ASTRA_DB_COLLECTION: "comics",
    PROCESS_LOG_COLLECTION: "process_log",
    RATE_LIMITER: {} as Env["RATE_LIMITER"],
    USER_RATE_LIMITER: {} as Env["USER_RATE_LIMITER"],
    AUTH_TOKENS: {} as Env["AUTH_TOKENS"],
    BROWSER: {} as Env["BROWSER"],
    ...overrides,
  };
}

const noopController = {} as ScheduledController;

describe("scheduled keep-alive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads from the store when Astra env is set", async () => {
    const listComics = vi.fn(async () => []);
    vi.spyOn(comicStore, "getComicStore").mockReturnValue({
      listComics,
    } as unknown as ReturnType<typeof comicStore.getComicStore>);

    await scheduled(noopController, makeEnv());
    expect(listComics).toHaveBeenCalledOnce();
  });

  it("no-ops when Astra env is empty", async () => {
    const spy = vi.spyOn(comicStore, "getComicStore");
    await scheduled(
      noopController,
      makeEnv({ ASTRA_DB_API_ENDPOINT: "", ASTRA_DB_APPLICATION_TOKEN: "" }),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("never throws when the store fails", async () => {
    vi.spyOn(comicStore, "getComicStore").mockReturnValue({
      listComics: vi.fn(async () => {
        throw new Error("astra down");
      }),
    } as unknown as ReturnType<typeof comicStore.getComicStore>);

    await expect(scheduled(noopController, makeEnv())).resolves.toBeUndefined();
  });
});

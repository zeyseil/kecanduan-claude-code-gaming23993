import { beforeEach, describe, expect, it } from "vitest";
import {
  getLoggedEntries,
  inMemoryProcessLogRepository,
  resetInMemoryProcessLog,
} from "./inMemoryProcessLogRepository";

const { insertLog } = inMemoryProcessLogRepository;

describe("inMemoryProcessLogRepository", () => {
  beforeEach(() => {
    resetInMemoryProcessLog();
  });

  it("starts empty per user", () => {
    expect(getLoggedEntries("demo-user")).toEqual([]);
  });

  it("records an entry with a generated timestamp, scoped to user_id", async () => {
    await insertLog("user-a", {
      input_text: "baru baca monster ch33",
      ai_action: "updated",
      target_comic_id: "id-1",
      confirmed: true,
    });

    const entries = getLoggedEntries("user-a");
    expect(entries).toHaveLength(1);
    expect(entries[0].ai_action).toBe("updated");
    expect(entries[0].target_comic_id).toBe("id-1");
    expect(entries[0].ts).toBeTruthy();
    expect(getLoggedEntries("user-b")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { extractAgentMessage } from "./parseAgentResult";

const REAL_LANGFLOW_RESULT = {
  session_id: "fe794c9e-169b-4423-8826-efe95da26c65",
  outputs: [
    {
      outputs: [
        {
          outputs: {
            message: {
              message: 'Chapter untuk komik "Doraemon" telah berhasil diperbarui ke chapter 66.',
              type: "text",
            },
          },
        },
      ],
    },
  ],
};

describe("extractAgentMessage", () => {
  it("mengambil pesan dari struktur Langflow asli", () => {
    expect(extractAgentMessage(REAL_LANGFLOW_RESULT)).toBe(
      'Chapter untuk komik "Doraemon" telah berhasil diperbarui ke chapter 66.',
    );
  });

  it("balik null kalau bentuk tidak dikenal", () => {
    expect(extractAgentMessage({ foo: "bar" })).toBeNull();
    expect(extractAgentMessage(null)).toBeNull();
    expect(extractAgentMessage("string")).toBeNull();
    expect(extractAgentMessage({ outputs: [] })).toBeNull();
    expect(extractAgentMessage({ outputs: [{ outputs: [{ outputs: { message: {} } }] }] })).toBeNull();
  });
});

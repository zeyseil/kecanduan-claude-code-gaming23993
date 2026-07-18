import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tulis } from "./Tulis";
import * as agentApi from "../lib/api/agent";

vi.mock("../lib/api/agent", async () => {
  const actual = await vi.importActual<typeof agentApi>("../lib/api/agent");
  return { ...actual, processAgentText: vi.fn() };
});

const processAgentTextMock = vi.mocked(agentApi.processAgentText);

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
  processAgentTextMock.mockReset();
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Tulis", () => {
  it("menolak proses kalau API key kosong", async () => {
    const user = userEvent.setup();
    render(<Tulis />);

    await user.type(screen.getByLabelText(/editor catatan komik/i), "baru baca naruto ch56");
    await user.click(screen.getByRole("button", { name: /proses dengan ai/i }));

    expect(await screen.findByText(/isi api key gemini/i)).toBeInTheDocument();
    expect(processAgentTextMock).not.toHaveBeenCalled();
  });

  it("memanggil processAgentText dan menampilkan hasil saat sukses", async () => {
    processAgentTextMock.mockResolvedValue({ session_id: "abc", outputs: [] });
    const user = userEvent.setup();
    render(<Tulis />);

    await user.type(screen.getByLabelText(/google api key/i), "AIzaTestKey");
    await user.type(screen.getByLabelText(/editor catatan komik/i), "baru baca naruto ch56");
    await user.click(screen.getByRole("button", { name: /proses dengan ai/i }));

    await waitFor(() => {
      expect(processAgentTextMock).toHaveBeenCalledWith({
        teks_input: "baru baca naruto ch56",
        google_api_key: "AIzaTestKey",
      });
    });
    expect(await screen.findByText(/hasil dari ai agent/i)).toBeInTheDocument();
    expect(screen.getByText(/"session_id": "abc"/)).toBeInTheDocument();
  });

  it("menampilkan pesan error saat processAgentText gagal", async () => {
    processAgentTextMock.mockRejectedValue(new Error("Langflow gagal memproses permintaan"));
    const user = userEvent.setup();
    render(<Tulis />);

    await user.type(screen.getByLabelText(/google api key/i), "AIzaTestKey");
    await user.type(screen.getByLabelText(/editor catatan komik/i), "baru baca naruto ch56");
    await user.click(screen.getByRole("button", { name: /proses dengan ai/i }));

    expect(await screen.findByText(/langflow gagal memproses permintaan/i)).toBeInTheDocument();
  });
});

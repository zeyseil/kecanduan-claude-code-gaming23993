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

  it("memanggil processAgentText dan menampilkan ringkasan human-readable saat sukses", async () => {
    processAgentTextMock.mockResolvedValue({
      message: "Chapter komik Naruto diupdate ke 56.",
      tool_calls: [
        {
          name: "update_chapter",
          args: { comic_id: "c-1", chapter: 56 },
          result: { comic_id: "c-1", updated: true, previous_chapter: 55 },
        },
      ],
    });
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
    expect(screen.getAllByText(/chapter komik naruto diupdate ke 56/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 tool dipanggil/i)).toBeInTheDocument();
    expect(screen.getByText(/"update_chapter"/)).toBeInTheDocument();
  });

  it("menampilkan blok Batasan fitur ini di mode Tulis bebas", () => {
    render(<Tulis />);
    expect(screen.getByText("Batasan fitur ini:")).toBeInTheDocument();
    expect(screen.getByText(/per model per hari/i)).toBeInTheDocument();
  });

  it("mengirim model pilihan user saat memproses", async () => {
    processAgentTextMock.mockResolvedValue({ message: "ok", tool_calls: [] });
    const user = userEvent.setup();
    render(<Tulis />);

    await user.type(screen.getByLabelText(/google api key/i), "AIzaTestKey");
    await user.selectOptions(screen.getByLabelText(/model gemini/i), "gemini-2.5-flash");
    await user.type(screen.getByLabelText(/editor catatan komik/i), "baru baca naruto ch56");
    await user.click(screen.getByRole("button", { name: /proses dengan ai/i }));

    await waitFor(() =>
      expect(processAgentTextMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-2.5-flash" }),
      ),
    );
  });

  it("menampilkan pesan error saat processAgentText gagal", async () => {
    processAgentTextMock.mockRejectedValue(new Error("Gemini menolak permintaan"));
    const user = userEvent.setup();
    render(<Tulis />);

    await user.type(screen.getByLabelText(/google api key/i), "AIzaTestKey");
    await user.type(screen.getByLabelText(/editor catatan komik/i), "baru baca naruto ch56");
    await user.click(screen.getByRole("button", { name: /proses dengan ai/i }));

    expect(await screen.findByText(/gemini menolak permintaan/i)).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelPicker } from "./ModelPicker";
import * as agentApi from "../lib/api/agent";

vi.mock("../lib/api/agent", async () => {
  const actual = await vi.importActual<typeof agentApi>("../lib/api/agent");
  return { ...actual, fetchGeminiModels: vi.fn() };
});

const fetchGeminiModelsMock = vi.mocked(agentApi.fetchGeminiModels);

beforeEach(() => {
  fetchGeminiModelsMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ModelPicker", () => {
  it("menampilkan daftar kurasi awal tanpa memanggil API", () => {
    render(<ModelPicker value="" onChange={vi.fn()} apiKey="" />);
    expect(screen.getByRole("option", { name: /Flash-Lite \(default\)/ })).toBeInTheDocument();
    expect(fetchGeminiModelsMock).not.toHaveBeenCalled();
  });

  it("memanggil onChange saat memilih model", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker value="" onChange={onChange} apiKey="" />);

    await user.selectOptions(screen.getByLabelText(/model gemini/i), "gemini-flash-latest");
    expect(onChange).toHaveBeenCalledWith("gemini-flash-latest");
  });

  it("menampilkan error kalau tombol muat ditekan tanpa API key", async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={vi.fn()} apiKey="" />);

    await user.click(screen.getByRole("button", { name: /muat dari api key/i }));
    expect(screen.getByText(/isi api key gemini dulu/i)).toBeInTheDocument();
    expect(fetchGeminiModelsMock).not.toHaveBeenCalled();
  });

  it("memuat model dari API key dan menambahkannya ke daftar", async () => {
    fetchGeminiModelsMock.mockResolvedValue([
      {
        id: "gemini-3-pro",
        label: "gemini-3-pro",
        note: "Terdeteksi.",
        quota: null,
        curated: false,
      },
    ]);
    const user = userEvent.setup();
    render(<ModelPicker value="" onChange={vi.fn()} apiKey="AIzaKey" />);

    await user.click(screen.getByRole("button", { name: /muat dari api key/i }));

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /gemini-3-pro/ })).toBeInTheDocument(),
    );
  });
});

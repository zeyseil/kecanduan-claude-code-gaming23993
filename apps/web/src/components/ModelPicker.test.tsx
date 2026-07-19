import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ModelPicker } from "./ModelPicker";
import * as agentApi from "../lib/api/agent";

vi.mock("../lib/api/agent", async () => {
  const actual = await vi.importActual<typeof agentApi>("../lib/api/agent");
  return { ...actual, fetchGeminiModels: vi.fn() };
});

const fetchGeminiModelsMock = vi.mocked(agentApi.fetchGeminiModels);

beforeEach(() => {
  fetchGeminiModelsMock.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SAMPLE_MODEL = {
  id: "gemini-3-pro",
  label: "gemini-3-pro",
  note: "Terdeteksi.",
  quota: null,
  curated: false,
};

describe("ModelPicker", () => {
  it("tanpa API key: dropdown kosong, tidak memanggil API", () => {
    render(<ModelPicker value="" onChange={vi.fn()} apiKey="" />);
    expect(screen.getByText("Isi API key Gemini dulu")).toBeInTheDocument();
    expect(screen.getByLabelText("Model Gemini")).toBeDisabled();
    expect(fetchGeminiModelsMock).not.toHaveBeenCalled();
  });

  it("mengetik API key memicu auto-load setelah debounce", async () => {
    fetchGeminiModelsMock.mockResolvedValue([SAMPLE_MODEL]);
    const { rerender } = render(<ModelPicker value="" onChange={vi.fn()} apiKey="AIza" />);

    expect(fetchGeminiModelsMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(fetchGeminiModelsMock).toHaveBeenCalledTimes(1);
    expect(fetchGeminiModelsMock).toHaveBeenCalledWith({ google_api_key: "AIza" });
    expect(screen.getByRole("option", { name: /gemini-3-pro/ })).toBeInTheDocument();

    rerender(<ModelPicker value="" onChange={vi.fn()} apiKey="AIza" />);
  });

  it("mengganti API key berturut-turut sebelum debounce selesai hanya fetch sekali", async () => {
    fetchGeminiModelsMock.mockResolvedValue([SAMPLE_MODEL]);
    const { rerender } = render(<ModelPicker value="" onChange={vi.fn()} apiKey="A" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender(<ModelPicker value="" onChange={vi.fn()} apiKey="AI" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender(<ModelPicker value="" onChange={vi.fn()} apiKey="AIza" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(fetchGeminiModelsMock).toHaveBeenCalledTimes(1);
    expect(fetchGeminiModelsMock).toHaveBeenCalledWith({ google_api_key: "AIza" });
  });

  it("mengosongkan API key membersihkan daftar tanpa fetch baru", async () => {
    fetchGeminiModelsMock.mockResolvedValue([SAMPLE_MODEL]);
    const { rerender } = render(<ModelPicker value="" onChange={vi.fn()} apiKey="AIza" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByRole("option", { name: /gemini-3-pro/ })).toBeInTheDocument();

    rerender(<ModelPicker value="" onChange={vi.fn()} apiKey="" />);
    expect(screen.getByText("Isi API key Gemini dulu")).toBeInTheDocument();
  });

  it("fetch gagal menampilkan pesan error, dropdown tetap kosong", async () => {
    fetchGeminiModelsMock.mockRejectedValue(new Error("API key ditolak"));
    render(<ModelPicker value="" onChange={vi.fn()} apiKey="AIza-salah" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(screen.getByText("API key ditolak")).toBeInTheDocument();
    expect(screen.getByLabelText("Model Gemini")).toBeDisabled();
  });
});

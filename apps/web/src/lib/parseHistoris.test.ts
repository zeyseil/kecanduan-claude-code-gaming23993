import { describe, expect, it } from "vitest";
import { parseHistoris } from "./parseHistoris";

describe("parseHistoris", () => {
  it("parse baris dasar dengan nomor urut dan spasi sebelum ':'", () => {
    const { ok, failed } = parseHistoris("162. Judul komik(manga) : ch11");
    expect(failed).toEqual([]);
    expect(ok).toEqual([
      { title: "Judul komik", type_tag: "manga", is_adult: false, latest_chapter: 11, status: "ongoing" },
    ]);
  });

  it("parse tag jenis valid tanpa spasi konsisten", () => {
    const { ok, failed } = parseHistoris("172.Judul lain(2022)(manhwa):ch32");
    expect(failed).toEqual([]);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toEqual({
      title: "Judul lain",
      type_tag: "manhwa",
      is_adult: false,
      latest_chapter: 32,
      status: "ongoing",
    });
  });

  it("grup kurung terakhir yang jadi tag jenis, bukan grup pertama", () => {
    const { ok } = parseHistoris("Monsters(2022)(manhwa):ch10");
    expect(ok[0].type_tag).toBe("manhwa");
    expect(ok[0].title).toBe("Monsters");
  });

  it("status completed menempel di belakang chapter", () => {
    const { ok, failed } = parseHistoris("176.Judul(manga):ch38(completed)");
    expect(failed).toEqual([]);
    expect(ok[0]).toEqual({
      title: "Judul",
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 38,
      status: "completed",
    });
  });

  it("chapter desimal", () => {
    const { ok } = parseHistoris("Judul(manga):ch11.5");
    expect(ok[0].latest_chapter).toBe(11.5);
  });

  it("chapter desimal dengan tanda hubung (konvensi user, mis. ch38-1 = 38.1)", () => {
    const { ok, failed } = parseHistoris("76. Shingan no yuusha (manga) : ch38-1");
    expect(failed).toEqual([]);
    expect(ok[0].latest_chapter).toBe(38.1);
  });

  it("konvensi 18+ manhwa18 -> is_adult true, type_tag dasar", () => {
    const { ok, failed } = parseHistoris("Judul dewasa(manhwa18):ch5");
    expect(failed).toEqual([]);
    expect(ok[0]).toEqual({
      title: "Judul dewasa",
      type_tag: "manhwa",
      is_adult: true,
      latest_chapter: 5,
      status: "ongoing",
    });
  });

  it("konvensi 18+ manhwap/manhuap -> is_adult true (bug lama: p dibuang diam-diam)", () => {
    const { ok: okWa } = parseHistoris("Judul A(manhwap):ch1");
    expect(okWa[0]).toEqual({
      title: "Judul A",
      type_tag: "manhwa",
      is_adult: true,
      latest_chapter: 1,
      status: "ongoing",
    });

    const { ok: okUa } = parseHistoris("Judul B(manhuap):ch1");
    expect(okUa[0]).toEqual({
      title: "Judul B",
      type_tag: "manhua",
      is_adult: true,
      latest_chapter: 1,
      status: "ongoing",
    });
  });

  it("baris sampah masuk failed, tidak melempar error, dan tidak menghentikan baris lain", () => {
    const text = ["Judul benar(manga):ch1", "baris sampah tanpa format", "Judul lain(manhwa):ch2"].join("\n");
    const { ok, failed } = parseHistoris(text);
    expect(ok).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0].line).toBe(2);
    expect(failed[0].raw).toBe("baris sampah tanpa format");
  });

  it("tag jenis tidak dikenal (ada kurung tapi typo) TETAP masuk failed", () => {
    const { ok, failed } = parseHistoris("Judul(novel):ch1");
    expect(ok).toEqual([]);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatch(/tag jenis tidak dikenal/);
  });

  it("baris tanpa kurung jenis sama sekali -> type_tag null (perlu deteksi), bukan gagal", () => {
    const { ok, failed } = parseHistoris("Solo Leveling : ch179");
    expect(failed).toEqual([]);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toEqual({
      title: "Solo Leveling",
      type_tag: null,
      is_adult: false,
      latest_chapter: 179,
      status: "ongoing",
    });
  });

  it("baris kosong diabaikan, bukan dianggap gagal", () => {
    const { ok, failed } = parseHistoris("Judul(manga):ch1\n\n\nJudul2(manga):ch2");
    expect(ok).toHaveLength(2);
    expect(failed).toEqual([]);
  });

  it("judul yang memuat titik dua tetap terpisah benar di ':' terakhir", () => {
    const { ok, failed } = parseHistoris("Solo Leveling: Ragnarok(manhwa):ch3");
    expect(failed).toEqual([]);
    expect(ok[0].title).toBe("Solo Leveling: Ragnarok");
    expect(ok[0].type_tag).toBe("manhwa");
    expect(ok[0].latest_chapter).toBe(3);
  });
});

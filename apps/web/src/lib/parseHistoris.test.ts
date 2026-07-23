import { describe, expect, it } from "vitest";
import { parseHistoris } from "./parseHistoris";

describe("parseHistoris", () => {
  it("parse baris dasar dengan nomor urut dan spasi sebelum ':'", () => {
    const { ok, failed } = parseHistoris("162. Judul komik(manga) : ch11");
    expect(failed).toEqual([]);
    expect(ok).toEqual([
      { id: expect.any(String), title: "Judul komik", type_tag: "manga", is_adult: false, latest_chapter: 11, status: "ongoing", note: null },
    ]);
  });

  it("parse tag jenis valid tanpa spasi konsisten", () => {
    const { ok, failed } = parseHistoris("172.Judul lain(2022)(manhwa):ch32");
    expect(failed).toEqual([]);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toEqual({
      id: expect.any(String),
      title: "Judul lain",
      type_tag: "manhwa",
      is_adult: false,
      latest_chapter: 32,
      status: "ongoing",
      note: null,
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
      id: expect.any(String),
      title: "Judul",
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 38,
      status: "completed",
      note: null,
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
      id: expect.any(String),
      title: "Judul dewasa",
      type_tag: "manhwa",
      is_adult: true,
      latest_chapter: 5,
      status: "ongoing",
      note: null,
    });
  });

  it("konvensi 18+ manhwap/manhuap -> is_adult true (bug lama: p dibuang diam-diam)", () => {
    const { ok: okWa } = parseHistoris("Judul A(manhwap):ch1");
    expect(okWa[0]).toEqual({
      id: expect.any(String),
      title: "Judul A",
      type_tag: "manhwa",
      is_adult: true,
      latest_chapter: 1,
      status: "ongoing",
      note: null,
    });

    const { ok: okUa } = parseHistoris("Judul B(manhuap):ch1");
    expect(okUa[0]).toEqual({
      id: expect.any(String),
      title: "Judul B",
      type_tag: "manhua",
      is_adult: true,
      latest_chapter: 1,
      status: "ongoing",
      note: null,
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
      id: expect.any(String),
      title: "Solo Leveling",
      type_tag: null,
      is_adult: false,
      latest_chapter: 179,
      status: "ongoing",
      note: null,
    });
  });

  it("tiap entri punya id yang unik (untuk key & edit judul di preview)", () => {
    // Sengaja pakai judul yang sama dua kali — id harus tetap unik.
    const { ok } = parseHistoris("Solo Leveling(manhwa):ch1\nSolo Leveling(manhwa):ch2");
    expect(ok).toHaveLength(2);
    expect(ok[0].id).toBeTruthy();
    expect(ok[1].id).toBeTruthy();
    expect(ok[0].id).not.toBe(ok[1].id);
  });

  it("baris kosong diabaikan, bukan dianggap gagal", () => {
    const { ok, failed } = parseHistoris("Judul(manga):ch1\n\n\nJudul2(manga):ch2");
    expect(ok).toHaveLength(2);
    expect(failed).toEqual([]);
  });

  // --- toleransi dari dogfooding import 308 entri (baris asli dari log) -----

  it("status 'end' menjadi completed", () => {
    const { ok, failed } = parseHistoris("9. Return of the 8th class magician : ch81(end)");
    expect(failed).toEqual([]);
    expect(ok[0].status).toBe("completed");
    expect(ok[0].note).toBeNull();
  });

  it("status bebas jadi note, status tetap ongoing, baris TIDAK gagal", () => {
    const { ok, failed } = parseHistoris(
      [
        "352.monster devourer(manhwa):ch45(hiatus)",
        "12. Demon king who lost his job : ch361(baca di warungkomik)",
        "339.the extra academy survival guide(manhwa):ch82(S1 end)",
        "279.i have to be monster(manhua):ch43(cancelled?)",
      ].join("\n"),
    );
    expect(failed).toEqual([]);
    expect(ok.map((e) => [e.status, e.note])).toEqual([
      ["ongoing", "hiatus"],
      ["ongoing", "baca di warungkomik"],
      ["ongoing", "S1 end"],
      ["ongoing", "cancelled?"],
    ]);
  });

  it("kurung nested 'end(ada prequel)' -> completed + note", () => {
    const { ok, failed } = parseHistoris(
      "257.cultivator against hero society (manhua):ch238(end(ada prequel))",
    );
    expect(failed).toEqual([]);
    expect(ok[0].status).toBe("completed");
    expect(ok[0].note).toBe("ada prequel");
  });

  it("pemisah ';' diterima sebagai fallback", () => {
    const { ok, failed } = parseHistoris("20. Isekai cheat magic swords man(manga) ; ch 24-2");
    expect(failed).toEqual([]);
    expect(ok[0].title).toBe("Isekai cheat magic swords man");
    expect(ok[0].latest_chapter).toBe(24.2);
  });

  it("chapter 'c13' tanpa h, 'ch,60', dan trailing ':' kosong diterima", () => {
    const { ok, failed } = parseHistoris(
      [
        "134. Zaako zako zako sensei (manga) :c13",
        "360.the regressed mercenary machinations(manhwa):ch,60",
        "26. Nano machine : ch148:",
      ].join("\n"),
    );
    expect(failed).toEqual([]);
    expect(ok.map((e) => e.latest_chapter)).toEqual([13, 60, 148]);
  });

  it("emoji di ekor chapter dibuang", () => {
    const { ok, failed } = parseHistoris("52. Alone necromancer : ch68 🥰😏❤️");
    expect(failed).toEqual([]);
    expect(ok[0].latest_chapter).toBe(68);
  });

  it("tag mangashort/manga{colored} -> manga + note; hmanga -> manga 18+", () => {
    const { ok, failed } = parseHistoris(
      [
        "182.Company and Private Life(mangashort):ch8",
        "217.Yakuza cleaner(manga{colored}):ch25",
        "235.Yuusha sama(hmanga):ch6",
      ].join("\n"),
    );
    expect(failed).toEqual([]);
    expect(ok[0]).toMatchObject({ type_tag: "manga", is_adult: false, note: "short" });
    expect(ok[1]).toMatchObject({ type_tag: "manga", is_adult: false, note: "colored" });
    expect(ok[2]).toMatchObject({ type_tag: "manga", is_adult: true, note: null });
  });

  it("note tag dan note status digabung", () => {
    const { ok } = parseHistoris("183.A goddess(mangashort):ch5(end)");
    expect(ok[0].status).toBe("completed");
    expect(ok[0].note).toBe("short");

    const { ok: ok2 } = parseHistoris("Judul(mangashort):ch5(hiatus)");
    expect(ok2[0].note).toBe("short; hiatus");
  });

  it("baris terpotong tanpa pemisah TETAP gagal", () => {
    const { ok, failed } = parseHistoris("185.virgin knight who is the frontier lord in");
    expect(ok).toEqual([]);
    expect(failed).toHaveLength(1);
  });

  it("judul yang memuat titik dua tetap terpisah benar di ':' terakhir", () => {
    const { ok, failed } = parseHistoris("Solo Leveling: Ragnarok(manhwa):ch3");
    expect(failed).toEqual([]);
    expect(ok[0].title).toBe("Solo Leveling: Ragnarok");
    expect(ok[0].type_tag).toBe("manhwa");
    expect(ok[0].latest_chapter).toBe(3);
  });
});

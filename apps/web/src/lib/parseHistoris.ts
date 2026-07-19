// Parser format data historis (SPEC.md §7). Sepenuhnya deterministik — TIDAK
// melibatkan AI sama sekali, karena formatnya sudah teratur dan 300+ entri
// tidak mungkin muat di kuota Gemini (lihat CLAUDE.md, temuan kuota free tier).

import type { Status, TypeTag } from "../types/comic";
import { STATUSES, TYPE_TAGS } from "../types/comic";

export interface ParsedEntry {
  title: string;
  /** null artinya "jenis tidak ditulis user" — perlu deteksi otomatis via MangaDex. */
  type_tag: TypeTag | null;
  /** Field terpisah dari type_tag — JANGAN digabung (SPEC.md §8, bug aplikasi lama). */
  is_adult: boolean;
  latest_chapter: number;
  status: Status;
}

export interface FailedLine {
  /** Nomor baris di teks asli (1-based), bukan nomor urut di dalam baris. */
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  ok: ParsedEntry[];
  failed: FailedLine[];
}

/**
 * Pisahkan penanda 18+ dari tag jenis.
 *
 * Dua konvensi yang dipakai user di data historisnya: sufiks `18` (`manhwa18`)
 * dan sufiks `p` (`manhwap`). Keduanya berarti 18+ — aplikasi lama membuang
 * huruf `p` diam-diam sehingga informasi 18+ hilang (SPEC.md §8).
 */
function parseTypeTag(raw: string): { type_tag: TypeTag; is_adult: boolean } | null {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

  const adultMatch = /^(manga|manhwa|manhua)(18|p)$/.exec(cleaned);
  if (adultMatch) {
    return { type_tag: adultMatch[1] as TypeTag, is_adult: true };
  }

  if (TYPE_TAGS.includes(cleaned as TypeTag)) {
    return { type_tag: cleaned as TypeTag, is_adult: false };
  }

  return null;
}

/** Ambil semua isi grup kurung di bagian judul, beserta judul yang sudah dibersihkan. */
function splitTitleAndGroups(head: string): { title: string; groups: string[] } {
  const groups: string[] = [];
  const title = head.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    groups.push(inner.trim());
    return " ";
  });
  return { title: title.replace(/\s+/g, " ").trim(), groups };
}

function parseLine(raw: string): ParsedEntry | string {
  // Nomor urut di depan bukan id permanen — dibuang (SPEC.md §7).
  const withoutIndex = raw.trim().replace(/^\d+\s*\.\s*/, "");

  // Pemisah judul/chapter adalah ':' terakhir, supaya judul yang memuat ':'
  // (mis. "Solo Leveling: Ragnarok") tidak terpotong di tempat yang salah.
  const sep = withoutIndex.lastIndexOf(":");
  if (sep === -1) {
    return "tidak ada tanda ':' pemisah judul dan chapter";
  }

  const head = withoutIndex.slice(0, sep);
  const tail = withoutIndex.slice(sep + 1).trim();

  const { title, groups } = splitTitleAndGroups(head);
  if (title === "") {
    return "judul kosong";
  }

  // Nol grup kurung → jenis tidak ditulis user, tandai null untuk deteksi otomatis.
  // Ada grup tapi grup terakhir bukan jenis valid → TETAP gagal (mis. typo
  // "(mangaa)" harus terlihat, bukan diam-diam dilempar ke auto-detect).
  let type_tag: TypeTag | null = null;
  let is_adult = false;
  if (groups.length > 0) {
    // Kalau ada 2 grup (mis. "Monsters(2022)(manhwa)"), grup TERAKHIR adalah jenis.
    const typeInfo = parseTypeTag(groups[groups.length - 1]);
    if (!typeInfo) {
      return `tag jenis tidak dikenal: "${groups[groups.length - 1]}" (harus ${TYPE_TAGS.join("/")})`;
    }
    type_tag = typeInfo.type_tag;
    is_adult = typeInfo.is_adult;
  }

  // Chapter boleh desimal; status opsional menempel di belakang, mis. "ch38(completed)".
  // Selingan/desimal ditulis user dengan '.', ',', atau '-' (mis. "ch38-1" = 38.1).
  const chapterMatch = /^ch\s*(\d+(?:[.,-]\d+)?)\s*(?:\(([^)]*)\))?$/i.exec(tail);
  if (!chapterMatch) {
    return `bagian chapter tidak dikenal: "${tail}"`;
  }

  const latest_chapter = Number(chapterMatch[1].replace(/[,-]/, "."));
  if (Number.isNaN(latest_chapter)) {
    return `nomor chapter tidak valid: "${chapterMatch[1]}"`;
  }

  let status: Status = "ongoing";
  if (chapterMatch[2] !== undefined) {
    const rawStatus = chapterMatch[2].trim().toLowerCase();
    if (!STATUSES.includes(rawStatus as Status)) {
      return `status tidak dikenal: "${chapterMatch[2]}" (harus ${STATUSES.join("/")})`;
    }
    status = rawStatus as Status;
  }

  return { title, type_tag, is_adult, latest_chapter, status };
}

/**
 * Parse teks historis multi-baris.
 *
 * Baris yang gagal TIDAK menggagalkan seluruh impor — dikumpulkan di `failed`
 * supaya user bisa memperbaikinya sendiri (300+ baris tulisan tangan pasti ada
 * yang meleset).
 */
export function parseHistoris(text: string): ParseResult {
  const ok: ParsedEntry[] = [];
  const failed: FailedLine[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === "") return;

    const parsed = parseLine(raw);
    if (typeof parsed === "string") {
      failed.push({ line: index + 1, raw: raw.trim(), reason: parsed });
    } else {
      ok.push(parsed);
    }
  });

  return { ok, failed };
}

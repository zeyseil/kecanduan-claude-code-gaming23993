// Parser format data historis (SPEC.md §7). Sepenuhnya deterministik — TIDAK
// melibatkan AI sama sekali, karena formatnya sudah teratur dan 300+ entri
// tidak mungkin muat di kuota Gemini (lihat CLAUDE.md, temuan kuota free tier).
//
// Dogfooding import 308 entri (CLAUDE.md) menunjukkan tulisan tangan user jauh
// lebih berantakan dari format nominal, jadi parser ini sengaja toleran:
// pemisah ';', chapter "c13"/"ch,60", emoji di ekor, status "end", dan status
// bebas ("hiatus", "S1 end") yang disimpan sebagai `note` alih-alih gagal.

import type { Status, TypeTag } from "../types/comic";
import { STATUSES, TYPE_TAGS } from "../types/comic";

export interface ParsedEntry {
  title: string;
  /** null artinya "jenis tidak ditulis user" — perlu deteksi otomatis via MangaDex/AniList. */
  type_tag: TypeTag | null;
  /** Field terpisah dari type_tag — JANGAN digabung (SPEC.md §8, bug aplikasi lama). */
  is_adult: boolean;
  latest_chapter: number;
  status: Status;
  /** Catatan bebas dari data asli (mis. "hiatus", "S1 end", "short") — informasi
   * yang bukan status/jenis valid tapi sayang dibuang. null kalau tidak ada. */
  note: string | null;
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

interface TypeTagInfo {
  type_tag: TypeTag;
  is_adult: boolean;
  /** Info ekstra dari tag non-standar (mis. "short", "colored"). */
  note: string | null;
}

/**
 * Pisahkan penanda 18+ dan varian non-standar dari tag jenis.
 *
 * Konvensi yang dipakai user di data historisnya:
 * - sufiks `18` / `p` (`manhwa18`, `mangap`) = 18+ — aplikasi lama membuang
 *   huruf `p` diam-diam sehingga informasi 18+ hilang (SPEC.md §8);
 * - prefiks `h` (`hmanga`) = 18+;
 * - sufiks `short` / `colored` (`mangashort`, `manga{colored}`) = varian
 *   format — dipetakan ke jenis dasarnya, info varian disimpan sebagai note.
 */
function parseTypeTag(raw: string): TypeTagInfo | null {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (TYPE_TAGS.includes(cleaned as TypeTag)) {
    return { type_tag: cleaned as TypeTag, is_adult: false, note: null };
  }

  const adultSuffix = /^(manga|manhwa|manhua)(18|p)$/.exec(cleaned);
  if (adultSuffix) {
    return { type_tag: adultSuffix[1] as TypeTag, is_adult: true, note: null };
  }

  const adultPrefix = /^h(manga|manhwa|manhua)$/.exec(cleaned);
  if (adultPrefix) {
    return { type_tag: adultPrefix[1] as TypeTag, is_adult: true, note: null };
  }

  const variant = /^(manga|manhwa|manhua)(short|colored)$/.exec(cleaned);
  if (variant) {
    return { type_tag: variant[1] as TypeTag, is_adult: false, note: variant[2] };
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

/**
 * Terjemahkan isi kurung setelah chapter jadi status + note.
 * - "completed"/"ongoing" → status literal.
 * - "end" (juga "end(ada prequel)" — kurung nested) → completed.
 * - Teks bebas lain ("hiatus", "S1 end", "baca di warungkomik") → BUKAN status:
 *   status tetap ongoing, teks aslinya disimpan sebagai note supaya tidak hilang.
 */
function resolveStatus(raw: string): { status: Status; note: string | null } {
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();

  if (STATUSES.includes(lower as Status)) {
    return { status: lower as Status, note: null };
  }
  if (lower === "end" || lower === "tamat" || lower === "selesai") {
    return { status: "completed", note: null };
  }
  const endWithNote = /^end\s*\((.*)\)$/.exec(lower);
  if (endWithNote) {
    return { status: "completed", note: endWithNote[1].trim() || null };
  }
  return { status: "ongoing", note: cleaned };
}

function combineNotes(...notes: Array<string | null>): string | null {
  const parts = notes.filter((n): n is string => n !== null && n !== "");
  return parts.length > 0 ? parts.join("; ") : null;
}

function parseLine(raw: string): ParsedEntry | string {
  // Nomor urut di depan bukan id permanen — dibuang (SPEC.md §7).
  const withoutIndex = raw.trim().replace(/^\d+\s*\.\s*/, "");

  // Pemisah judul/chapter adalah ':' terakhir (fallback ';' — beberapa baris
  // asli user memakainya), supaya judul yang memuat ':' (mis. "Solo Leveling:
  // Ragnarok") tidak terpotong di tempat yang salah. Trailing ':'/';' kosong
  // (mis. "ch148:") dibuang dulu supaya tidak terpilih sebagai pemisah.
  const trimmedLine = withoutIndex.replace(/[:;]\s*$/, "");
  let sep = trimmedLine.lastIndexOf(":");
  if (sep === -1) sep = trimmedLine.lastIndexOf(";");
  if (sep === -1) {
    return "tidak ada tanda ':' pemisah judul dan chapter";
  }

  const head = trimmedLine.slice(0, sep);
  // Emoji/simbol di ekor (mis. "ch68 🥰😏❤️") bukan data — dibuang.
  const tail = trimmedLine
    .slice(sep + 1)
    .replace(/[^\p{L}\p{N}()\s.,?-]+/gu, "")
    .trim();

  const { title, groups } = splitTitleAndGroups(head);
  if (title === "") {
    return "judul kosong";
  }

  // Nol grup kurung → jenis tidak ditulis user, tandai null untuk deteksi otomatis.
  // Ada grup tapi grup terakhir bukan jenis valid → TETAP gagal (mis. typo
  // "(mangaa)" harus terlihat, bukan diam-diam dilempar ke auto-detect).
  let type_tag: TypeTag | null = null;
  let is_adult = false;
  let tagNote: string | null = null;
  if (groups.length > 0) {
    // Kalau ada 2 grup (mis. "Monsters(2022)(manhwa)"), grup TERAKHIR adalah jenis.
    const typeInfo = parseTypeTag(groups[groups.length - 1]);
    if (!typeInfo) {
      return `tag jenis tidak dikenal: "${groups[groups.length - 1]}" (harus ${TYPE_TAGS.join("/")})`;
    }
    type_tag = typeInfo.type_tag;
    is_adult = typeInfo.is_adult;
    tagNote = typeInfo.note;
  }

  // Chapter boleh desimal; status opsional menempel di belakang, mis. "ch38(completed)".
  // Toleran terhadap variasi asli user: "c13" (tanpa h), "ch,60", "ch 24-2".
  // Grup status pakai (.*) supaya kurung nested ("end(ada prequel)") ikut tertangkap.
  const chapterMatch = /^ch?\s*[.,]?\s*(\d+(?:[.,-]\d+)?)\s*(?:\((.*)\))?$/i.exec(tail);
  if (!chapterMatch) {
    return `bagian chapter tidak dikenal: "${tail}"`;
  }

  const latest_chapter = Number(chapterMatch[1].replace(/[,-]/, "."));
  if (Number.isNaN(latest_chapter)) {
    return `nomor chapter tidak valid: "${chapterMatch[1]}"`;
  }

  let status: Status = "ongoing";
  let statusNote: string | null = null;
  if (chapterMatch[2] !== undefined) {
    const resolved = resolveStatus(chapterMatch[2]);
    status = resolved.status;
    statusNote = resolved.note;
  }

  return { title, type_tag, is_adult, latest_chapter, status, note: combineNotes(tagNote, statusNote) };
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

# TOOL_CONTRACTS.md — Kontrak Tool AI Agent

## Keputusan Arsitektur: Orkestrasi & Tool Hidup di Dalam Worker

Agent AI dijalankan **di dalam Cloudflare Worker** (`apps/worker/src/agent/`), memanggil **Gemini function calling** secara langsung. Tidak ada layanan orkestrasi eksternal.

Sebelumnya orkestrasi memakai **Langflow**, dan tool di bawah ini adalah endpoint HTTP `/internal/tools/*` yang dipanggil Langflow lewat jaringan. Itu dihapus karena dua alasan: (1) tidak ada lagi platform hosting gratis yang layak untuk Langflow (empat platform gagal berturut-turut), dan (2) Langflow menyebabkan tujuh bug/gap terpisah, dua di antaranya karena nilai literal (`ai_action`, `status`) hanya diminta lewat teks prompt. Arsitektur Langflow lengkap diarsipkan di branch `archive/langflow-orchestration`.

**Konsekuensi utama:** nilai yang dulu rawan salah sekarang dideklarasikan sebagai `enum` di schema fungsi Gemini, jadi ditegakkan oleh API — bukan lagi bergantung pada model mengingat instruksi prompt.

## Di Mana Kontrak Ini Hidup di Kode

| Bagian | File |
|---|---|
| Deklarasi schema + executor 6 tool | `apps/worker/src/agent/tools.ts` |
| Aturan keputusan (prompt) | `apps/worker/src/agent/systemPrompt.ts` |
| Loop tool-calling | `apps/worker/src/agent/runAgent.ts` |
| Pembungkus REST Gemini | `apps/worker/src/agent/geminiClient.ts` |

Schema di `tools.ts` adalah **satu sumber kebenaran** — dokumen ini menjelaskan *kenapa*, bukan mendefinisikan ulang bentuk datanya.

## Autentikasi

Tool tidak lagi punya lapis auth sendiri: semuanya fungsi in-process, tidak bisa dipanggil dari luar. Yang menjaga pintu masuk hanya `userAuth` (token bearer → `user_id` dari KV) di `/agent/process`. `user_id` diambil dari token itu dan diteruskan ke setiap executor sebagai `ToolContext` — **tidak pernah** menjadi parameter yang boleh diisi model, supaya agent tidak bisa salah sasaran menulis ke data user lain.

API key Google milik user dikirim per-request dari client dan dipakai hanya untuk request itu — tidak pernah disimpan di server (SPEC.md §3).

---

## 1. `cari_komik_mirip`

Wajib dipanggil pertama, sebelum tool manapun.

**Args:** `candidate_title` (string, wajib)
**Hasil:** `{ candidates: [{ comic_id, title, score }] }` — maks 5, urut skor tertinggi.

Matching memakai normalisasi (lowercase, strip tanda baca/spasi ganda) + token-sort Levenshtein di `apps/worker/src/store/fuzzyMatch.ts` — **dihitung di kode, bukan oleh LLM**. Ini prinsip yang tidak boleh diubah tanpa konfirmasi user.

**Aturan keputusan** (di system prompt, agent hanya menerapkan skor — tidak menilai sendiri):

| Kondisi | Aksi |
|---|---|
| Skor tertinggi ≥ 0.85 DAN selisih ke kandidat kedua ≥ 0.15 | Cocok tunggal → `update_chapter` |
| Tidak ada kandidat dengan skor ≥ 0.5 | Tidak ada yang mirip → `buat_entry_baru` |
| Ada 2+ kandidat skor ≥ 0.5 dan selisih antar-skor teratas < 0.15 | Ambigu → JANGAN create/update, kembalikan pilihan ke user |

Angka ambang ini masih draft awal — sesuaikan setelah ada data pemakaian nyata.

## 2. `buat_entry_baru`

**Args:** `title`, `type_tag` (enum: manga/manhwa/manhua), `is_adult` (boolean), `chapter` (number, boleh desimal), `status` (enum: ongoing/completed, opsional)
**Hasil:** `{ comic_id, created: true }`

`is_adult` adalah field boolean **terpisah**, tidak pernah digabung ke `type_tag` (pelajaran dari bug aplikasi lama — SPEC.md §8). `status` kosong → default `ongoing`.

## 3. `update_chapter`

**Args:** `comic_id`, `chapter`, `status` (opsional)
**Hasil:** `{ comic_id, updated: true, previous_chapter }` — `previous_chapter` dikembalikan supaya balasan ke user bisa bilang "32 → 33", bukan sekadar "berhasil".

## 4. `cari_cover_mangadex`

**Args:** `title`
**Hasil:** `{ cover_url }` atau `{ cover_url: null }` kalau tidak ditemukan.

**Tool ini HANYA mencari, tidak menyimpan.** Gap ini pernah menyebabkan bug nyata: cover ditemukan tapi comic tetap kosong, karena tidak ada yang menuliskannya. Agent wajib memanggil `set_cover` setelahnya (lihat §5).

**Rate limit MangaDex 5 req/detik bersifat per-IP, bukan per-user** — beda dari kuota Gemini yang per-API-key. Karena itu ada throttle token-bucket terpusat lewat Durable Object (`apps/worker/src/durable-objects/RateLimiter.ts`) yang membatasi total panggilan MangaDex dari seluruh Worker; kalau penuh ia mengantre singkat, bukan gagal.

## 5. `set_cover`

**Args:** `comic_id`, `cover_url`
**Hasil:** `{ comic_id, updated: true }`, atau `{ error }` kalau comic tidak ditemukan.

Dipanggil hanya kalau `cari_cover_mangadex` mengembalikan `cover_url` non-null.

## 6. `log_proses`

**Wajib dipanggil di SEMUA cabang** (created / updated / ambiguous) — audit trail, SPEC.md §9.

**Args:** `input_text`, `ai_action` (enum: created/updated/ambiguous), `target_comic_id` (opsional, kosong saat ambiguous), `confirmed` (boolean)
**Hasil:** `{ logged: true }`

`confirmed`: `true` kalau langsung dieksekusi otomatis, `false` untuk kasus ambigu yang masih menunggu user memilih.

---

## Penanganan Error

Executor **tidak melempar exception** untuk kegagalan yang wajar (comic tidak ditemukan, arg tidak valid). Mereka mengembalikan `{ error: "..." }`, yang diteruskan ke model sebagai `functionResponse` — sehingga agent bisa menjelaskan masalahnya ke user alih-alih seluruh run mati. Hanya kegagalan Gemini itu sendiri (jaringan/HTTP error) dan `MAX_TURNS` terlampaui yang naik jadi `502` di `/agent/process`.

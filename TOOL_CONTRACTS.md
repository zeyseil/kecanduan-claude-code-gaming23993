# TOOL_CONTRACTS.md — Kontrak Endpoint untuk Tool Langflow

## Keputusan Arsitektur: Tool Diimplementasikan di Worker yang Sama (Hono)

Ini menjawab open question terakhir di `SPEC.md` §10. Rekomendasi: **semua endpoint tool di bawah ini hidup di Worker Hono yang sama** dengan `/agent/process` dan `/comics` (bukan backend terpisah). Alasan: konsisten dengan prioritas "minim maintenance" — satu service untuk dirawat, bukan dua; Cloudflare Worker + KV/D1 sudah cukup untuk beban kerja personal ini; menghindari latency tambahan antar-service. Kalau nanti beban kerja berkembang jauh lebih besar, endpoint ini bisa dipisah ke service sendiri tanpa mengubah kontraknya (cuma pindah base URL).

## Autentikasi Internal (beda dari auth user)

Endpoint di bawah ini dipanggil oleh **Langflow**, bukan langsung oleh client (Tauri/Capacitor). Jadi butuh lapis auth terpisah dari token user biasa:

- Header wajib: `X-Internal-Secret: <secret statis>` — disimpan sebagai Worker Secret, dikonfigurasi juga di setiap Tool component Langflow sebagai header tetap (bukan sesuatu yang diisi LLM)
- Header wajib: `X-User-Id: <user_id>` — nilai ini **fixed/tetap per-run**, diisi lewat `tweaks` saat Worker memanggil `/run` Langflow (sama seperti API key Gemini di SPEC.md §3), BUKAN parameter yang boleh diisi/ditentukan oleh reasoning agent. Ini mencegah agent salah sasaran menulis ke data user lain.

## 1. POST /internal/tools/find-similar

Dipanggil pertama sebelum tool manapun lain — implementasi tool `cari_komik_mirip`.

**Request:**
```json
{ "candidate_title": "monster" }
```

**Response:**
```json
{
  "candidates": [
    { "comic_id": "uuid-1", "title": "Monsters (2022)", "score": 0.91 },
    { "comic_id": "uuid-2", "title": "Monster Girl Doctor", "score": 0.58 }
  ]
}
```
- Maks 5 kandidat, urut skor tertinggi
- Matching: normalisasi (lowercase, hilangkan tanda baca/spasi ganda) + fuzzy string similarity (mis. token-sort ratio), dikerjakan di kode Worker — bukan oleh LLM

**Aturan keputusan (dijalankan di Agent, bukan agent yang menebak sendiri):**
| Kondisi | Aksi |
|---|---|
| Skor tertinggi ≥ 0.85 DAN kandidat kedua < skor tertinggi − 0.15 | Cocok tunggal → panggil `update-chapter` |
| Tidak ada kandidat dengan skor ≥ 0.5 | Tidak ada yang mirip → panggil `create-comic` |
| Ada 2+ kandidat dengan skor ≥ 0.5 dan selisih antar-skor teratas < 0.15 | Ambigu → JANGAN panggil tool lain, kembalikan opsi ke user |

Angka ambang ini draft awal — perlu disesuaikan setelah ada data pemakaian nyata.

## 2. POST /internal/tools/create-comic

Implementasi tool `buat_entry_baru`.

**Request:**
```json
{
  "title": "Monsters",
  "type_tag": "manhwa",
  "is_adult": false,
  "chapter": 32,
  "status": null
}
```
**Response:**
```json
{ "comic_id": "uuid-3", "created": true }
```
- `type_tag` hanya salah satu dari: `manga`, `manhwa`, `manhua` (lihat SPEC.md §5 — is_adult terpisah, tidak digabung ke sini)
- `chapter`: number, mendukung desimal (mis. 11.5)
- `status`: nullable, hanya `"completed"` atau `null` (default ongoing)

## 3. POST /internal/tools/update-chapter

Implementasi tool `update_chapter`.

**Request:**
```json
{ "comic_id": "uuid-1", "chapter": 33, "status": null }
```
**Response:**
```json
{ "comic_id": "uuid-1", "updated": true, "previous_chapter": 32 }
```
- `previous_chapter` dikembalikan supaya Chat Output bisa menampilkan "chapter 32 → 33", bukan cuma "berhasil update"

## 4. POST /internal/tools/fetch-cover

Implementasi tool `cari_cover_mangadex`. Hanya dipanggil setelah `create-comic` sukses, tidak dipanggil saat update chapter.

**Request:**
```json
{ "title": "Monsters" }
```
**Response:**
```json
{ "cover_url": "https://uploads.mangadex.org/covers/.../cover.jpg" }
```
atau `{ "cover_url": null }` kalau tidak ditemukan di MangaDex — user melengkapi manual dari halaman visual.

**Rate limit MangaDex: 5 request/detik per alamat IP.** Ini penting karena sifatnya **per-IP, bukan per-user** — beda dari kuota Gemini yang per API-key. Kalau beberapa user memproses barengan dalam detik yang sama, permintaan gabungan ke MangaDex dari Worker bisa saja tembus 5 req/s meski masing-masing user cuma kirim 1 request. Worker WAJIB punya throttle terpusat (token-bucket sederhana, mis. via Durable Object atau counter timestamp di KV) yang membatasi total panggilan ke MangaDex dari seluruh Worker ke ≤5/detik — bukan cuma rate-limit per user_id yang sudah ada di SPEC.md §3. Kalau limit tercapai, antre singkat (beberapa ratus ms) alih-alih langsung gagal.

**Penting — `fetch-cover` HANYA mengembalikan `cover_url`, tidak menyimpannya.** Gap yang ditemukan lewat testing nyata: awalnya tidak ada mekanisme yang menulis hasil `cover_url` ke comic-nya, jadi comic yang dibuat AI selalu tetap `cover_url: null` walau `fetch-cover` sukses menemukan cover. Fix: tool baru `set-cover` (lihat §4b) — Agent WAJIB memanggilnya setelah `fetch-cover` mengembalikan `cover_url` non-null.

## 4b. POST /internal/tools/set-cover

Implementasi tool `set_cover`. Dipanggil setelah `fetch-cover` mengembalikan `cover_url` non-null, untuk menempelkan URL itu ke comic yang baru dibuat (atau comic manapun by `comic_id`). TIDAK dipanggil kalau `fetch-cover` mengembalikan `cover_url: null` (tidak ada yang perlu disimpan — user melengkapi manual dari halaman visual, sesuai §4).

**Request:**
```json
{ "comic_id": "uuid-3", "cover_url": "https://uploads.mangadex.org/covers/.../cover.jpg" }
```
**Response:**
```json
{ "comic_id": "uuid-3", "updated": true }
```
- 404 kalau `comic_id` tidak ditemukan
- `cover_url` wajib diisi (bukan endpoint untuk menghapus cover — pakai `PATCH /comics/:id` biasa dari web app untuk itu)

## 5. POST /internal/tools/log-process

Implementasi tool `log_proses`. **WAJIB dipanggil di SEMUA cabang** (created / updated / ambiguous) — lihat SPEC.md §9.

**Request:**
```json
{
  "input_text": "baru baca monster ch33",
  "ai_action": "updated",
  "target_comic_id": "uuid-1",
  "confirmed": true
}
```
**Response:**
```json
{ "logged": true }
```
- `ai_action`: salah satu dari `created`, `updated`, `ambiguous`
- `confirmed`: `true` kalau langsung dieksekusi otomatis (skor tinggi tunggal), `false` untuk kasus ambigu yang masih menunggu user memilih — field ini nanti di-update jadi `true`/`false` final setelah user merespons

## Ringkasan Kontrak untuk Konfigurasi Tool Component di Langflow

| Tool di Langflow | Endpoint | Field yang diisi LLM | Field fixed (tweaks, bukan LLM) |
|---|---|---|---|
| cari_komik_mirip | `/internal/tools/find-similar` | candidate_title | X-User-Id, X-Internal-Secret |
| buat_entry_baru | `/internal/tools/create-comic` | title, type_tag, is_adult, chapter, status | X-User-Id, X-Internal-Secret |
| update_chapter | `/internal/tools/update-chapter` | comic_id, chapter, status | X-User-Id, X-Internal-Secret |
| cari_cover_mangadex | `/internal/tools/fetch-cover` | title | X-User-Id, X-Internal-Secret |
| set_cover | `/internal/tools/set-cover` | comic_id, cover_url | X-User-Id, X-Internal-Secret |
| log_proses | `/internal/tools/log-process` | input_text, ai_action, target_comic_id, confirmed | X-User-Id, X-Internal-Secret |

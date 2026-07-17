# SPEC — Arsitektur Teknis

## 1. Komponen Sistem

```
[Tauri Desktop]   ─┐
[Capacitor Android] ─┴─→ [Cloudflare Worker] ─→ [DataStax Langflow /run] ─→ (Agent: Gemini + tools) ─→ [Backend/endpoint app existing] ─→ [Astra DB]
```

## 2. Frontend
- Satu codebase web (framework belum final — lihat Open Questions) dibungkus Tauri (desktop) dan Capacitor (Android)
- Dua halaman utama: Daftar Komik (grid visual) dan Tulis (editor teks) — lihat PRD.md §5
- State komik diambil/diubah lewat panggilan ke Cloudflare Worker, bukan langsung ke DataStax dari client

## 3. Cloudflare Worker (lapisan perantara)

Tanggung jawab:
- Autentikasi: token statis per user, disimpan di KV (`token:<value> → user_id`). Tidak ada sistem signup/login penuh — token dibuat manual dan dibagikan langsung ke tiap orang.
- Rate-limit per user_id (counter di KV dengan TTL)
- API key Google milik user dikirim dari client PER REQUEST, diteruskan ke Langflow lewat parameter `tweaks` — TIDAK PERNAH disimpan di Worker/KV
- Endpoint yang diexpose ke aplikasi:
  - `POST /agent/process` — body: `{ teks_input, google_api_key }` (user_id didapat dari token auth) → proxy ke Langflow `/run`, kembalikan hasil (proposal perubahan untuk dikonfirmasi)
  - `GET /comics` — daftar komik milik user
  - `POST /comics`, `PATCH /comics/:id` — create/update manual tanpa lewat AI (untuk edit langsung dari halaman visual)

Skeleton kode Worker (Hono) belum ditulis — kontrak endpoint tool internal (dipanggil Langflow) sudah didesain di `TOOL_CONTRACTS.md`, hidup di Worker yang sama di bawah path `/internal/tools/*`.

## 4. Peran Langflow
- Menerima teks bebas lewat `/run`, dengan `tweaks` berisi API key Gemini milik user yang sedang request
- Agent (Google Generative AI, tool calling enabled) mengekstrak entitas dan memanggil tool — lihat detail di `LANGFLOW_FLOW.md`
- Tool-tool memanggil endpoint aplikasi existing (belum diinventarisasi — lihat Open Questions)

## 5. Data Model (draft, gaya Astra DB / Cassandra)

Tabel `comics`:

| Field | Tipe | Keterangan |
|---|---|---|
| user_id | partition key | pemilik data, tidak ada data lintas user |
| comic_id | clustering key (uuid) | id unik komik |
| title | text | judul kanonis |
| aliases | list\<text\> | variasi judul yang pernah dipakai user (untuk histori fuzzy match) |
| type_tag | text | manga / manhwa / manhua (jenis dasar saja, TANPA varian 18+) |
| is_adult | boolean | true kalau komik 18+ — field terpisah, bukan varian dari type_tag |
| latest_chapter | decimal | mendukung nomor chapter desimal (mis. 11.5) |
| status | text | ongoing / completed |
| cover_url | text, nullable | diisi otomatis lewat auto-fetch API cover (lihat §9), fallback upload manual kalau tidak ditemukan |
| created_at / updated_at | timestamp | |

Tabel `process_log` (**WAJIB dari v1** — lihat §9 Keputusan):

| Field | Tipe |
|---|---|
| user_id | partition key |
| ts | clustering key (timestamp) |
| input_text | text |
| ai_action | text (created / updated / ambiguous) |
| target_comic_id | uuid, nullable |
| confirmed | boolean |

## 6. Keamanan
- API key Google: hanya transit client → Worker → tweaks Langflow, tidak disimpan permanen di manapun di sisi server
- Token akses aplikasi: statis per user di KV, revoke manual oleh pemilik proyek
- Rate-limit di Worker tetap diberlakukan meski kuota tidak lagi dibagi bersama, untuk mencegah pemakaian tidak sengaja berlebihan

## 7. Format Data Historis (referensi parser & pemahaman format)

Pola: `<no urut opsional>. <judul>(<tag jenis>[, tag lain]) : ch<angka>[(status opsional)]`

Catatan penting untuk parsing:
- Nomor urut di depan bukan id permanen, boleh diabaikan
- Kadang ada 2 grup kurung, mis. `Monsters(2022)(manhwa)` — grup TERAKHIR adalah tag jenis
- Spasi sebelum `(` dan `:` tidak konsisten antar baris
- Status opsional menempel di akhir setelah nomor chapter, mis. `ch38(completed)`
- Chapter bisa desimal (chapter selingan)

## 8. Status Proyek: Greenfield

Proyek ini dibangun dari awal (Langflow + DataStax + Astra DB + Cloudflare Worker). Ada source code aplikasi lama (Spring Boot + MySQL + Thymeleaf, AI Gemini terintegrasi langsung tanpa Langflow) yang pernah dibuat sebelumnya — **statusnya HANYA referensi, tidak dipakai/dilanjutkan.** Alasan: backend lama itu server-rendered (bukan API-first untuk Tauri/Capacitor), tidak ada isolasi data per-user, dan logic upsert-nya cacat (exact-match nama+chapter sekaligus, menyebabkan duplikat alih-alih update saat chapter berbeda) — mengulang dari awal dengan desain yang benar lebih murah daripada memperbaiki fondasi yang salah.

Insight yang tetap diambil dari source code lama sebagai referensi desain (BUKAN kode yang dipakai):
- Field komik: `name, type, lastChapterRead (harus numeric/decimal di versi baru, bukan String), dateAdded, lastModified, image`
- **Bug ditemukan, bukan fitur:** prompt AI lama menyuruh menghapus huruf 'p' dari `manhwap`/`manhuap` menjadi `manhwa`/`manhua`. Huruf 'p' itu sebenarnya penanda komik 18+ (dikonfirmasi user) — jadi sistem lama menghapus informasi 18+ secara diam-diam saat memproses, bukan sekadar membersihkan typo. Di data historis user sendiri konvensinya beda lagi: `(manhwa18)`. Dua konvensi berbeda ini disatukan di sistem baru lewat field `is_adult` (lihat §5 data model).
- Status `(completed)` menempel di belakang nomor chapter — pola nyata yang harus ditangani parser/agent
- Fitur sort by nama (asc/desc) dan tanggal (asc/desc) — dikonfirmasi sebagai fitur yang diinginkan di halaman visual baru
- Cover gambar di aplikasi lama diambil otomatis lewat script Python yang fetch API MangaDex, dengan cover kadang kosong untuk komik yang tidak terindeks di sana — pola ini jadi dasar keputusan cover di §9

## 9. Keputusan yang Sudah Diambil
- **Frontend**: React (satu codebase, dibungkus Tauri untuk desktop + Capacitor untuk Android)
- **Status 18+**: field terpisah `is_adult: boolean` di tabel `comics`, TIDAK ditumpangkan sebagai varian tag jenis — supaya tidak hilang/tertimpa seperti kasus 'p' di sistem lama
- **Cover gambar**: auto-fetch dari API publik (mis. MangaDex, meniru pendekatan lama) saat entry dibuat/diupdate agent; kalau tidak ditemukan (komik tidak terindeks di sumber tsb — pasti terjadi untuk sebagian judul, termasuk konten 18+ yang jarang terindeks), fallback ke upload manual oleh user di halaman visual. Bukan "pilih salah satu", tapi kombinasi keduanya.
- **Cloudflare Worker**: dibangun dengan **Hono** (bukan raw Fetch handler) — routing lebih rapi untuk beberapa endpoint (`/agent/process`, `/comics`, dll)
- **Audit trail**: WAJIB ada dari v1, bukan opsional. Tabel `process_log` (§5) bukan lagi "opsional" — setiap pemrosesan AI (berhasil, update, atau ambigu) harus tercatat di sana sejak awal, termasuk kapan user mengkonfirmasi/menolak proposal perubahan

## 10. Open Questions
Sudah tidak ada — kontrak endpoint tool sudah didesain di `TOOL_CONTRACTS.md` (termasuk keputusan: tool diimplementasikan di Worker Hono yang sama, bukan backend terpisah; rate limit MangaDex 5 req/s per IP dan mitigasinya).

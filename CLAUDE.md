# CLAUDE.md — Konteks Proyek untuk Claude Code

## Ringkasan Proyek
Aplikasi personal pencatat komik terbaca, dibungkus untuk Desktop (Tauri) dan Android (Capacitor), dengan fitur AI agent yang mengotomasi pencatatan dari input teks bebas. Lihat `PRD.md`, `SPEC.md`, `LANGFLOW_FLOW.md`, dan `TOOL_CONTRACTS.md` di root repo untuk detail keputusan produk dan arsitektur — baca semuanya sebelum mengerjakan fitur baru.

**Proyek ini greenfield.** Ada source code aplikasi lama (Spring Boot + MySQL, AI Gemini langsung tanpa Langflow) yang pernah dibuat — itu HANYA referensi desain (lihat SPEC.md §8 untuk insight yang diambil), JANGAN diasumsikan sebagai kode yang dilanjutkan atau di-porting. Backend/database untuk proyek ini dibangun dari nol sesuai stack di atas (Langflow/DataStax/Astra DB/Cloudflare Worker).

## Status Implementasi (per sesi terakhir)
Slice pertama frontend (PR #2, branch `feat/frontend-mock-ui`, base `docs/add-readme`):
- Monorepo **pnpm workspaces**; app web di `apps/web` (React 18 + Vite 5 + TypeScript + Tailwind 3).
- pnpm dijalankan via `corepack pnpm@9.15.9` — pnpm 11 crash di Node 21.0.0 environment ini.
- Tipe `Comic` di `apps/web/src/types/comic.ts` menegakkan `is_adult` terpisah dari `type_tag`, `latest_chapter` numeric, `status` enum.
- Halaman **Daftar Komik** (`routes/DaftarKomik.tsx`) + **Tulis** (`routes/Tulis.tsx`) jalan dengan **data mock** (`mocks/comics.ts`) — BELUM ada network/Worker/Langflow/DB.
- Logika sort/filter/search murni di `lib/comicList.ts` (di-unit-test).

Slice kedua (PR #4, branch `feat/add-comic-and-recent-strip`, base `feat/frontend-mock-ui`):
- `comics` di `DaftarKomik.tsx` jadi **React state** (in-memory, hilang saat refresh — belum ada localStorage/DB).
- Section **RecentStrip** (`components/RecentStrip.tsx`): horizontal-scroll di atas grid, `selectRecent()` (`lib/comicList.ts`) ambil 8 komik terbaru diupdate; disembunyikan saat search aktif.
- **AddComicForm** (`components/AddComicForm.tsx`, modal): Nama, Tipe, toggle 18+ (terpisah dari tipe), Chapter (desimal), Cover Image.
- **Crop cover** ke rasio 3:4 via `react-easy-crop` (dependency baru) — `components/ImageCropModal.tsx` + `lib/cropImage.ts` (canvas helper, testable terpisah dari komponen).
- `createComic()` (`lib/createComic.ts`): bangun `Comic` baru dari form, `status` default `"ongoing"`, `is_adult` apa adanya (tidak pernah masuk ke `type_tag`).
- Total test: `pnpm --filter web test` → 31 hijau.

Perintah: `pnpm --filter web dev|build|test|lint`.

Slice ketiga (branch `feat/add-comic-and-recent-strip`, lanjutan): scaffold `apps/worker` (Hono, dijalankan via `wrangler dev`, deps `hono` + devDeps `wrangler`/`@cloudflare/workers-types`).
- Tipe `Comic` di-mirror manual ke `apps/worker/src/types/comic.ts` (belum ada shared package — harus dijaga tetap sinkron dengan `apps/web/src/types/comic.ts`).
- Storage: `apps/worker/src/store/comicStore.ts`, in-memory `Map<user_id, Comic[]>` sebagai stub pengganti Astra DB — hilang saat cold start Worker, BUKAN persistensi nyata.
- Auth per-user (token→user_id via KV) DITUNDA — semua handler pakai konstanta `DEMO_USER_ID = "demo-user"` hardcode di `apps/worker/src/routes/comics.ts`.
- Endpoint: `GET /comics`, `POST /comics` (validasi field wajib), `PATCH /comics/:id` (404 kalau id tidak ada) — di `apps/worker/src/routes/comics.ts`. `POST /agent/process` di `apps/worker/src/routes/agent.ts` masih **stub**: validasi `teks_input`+`google_api_key` lalu balas `501 not_implemented` — BELUM memanggil Langflow beneran (belum ada instance Langflow yang di-deploy).
- Endpoint internal (`/internal/tools/*`: find-similar, create-comic, update-chapter, fetch-cover, log-process) BELUM dibuat — di luar scope slice ini.
- Test: `pnpm --filter worker test` → 13 hijau (comicStore, routes/comics, routes/agent via Hono `app.request`). Sudah dicoba manual dengan `wrangler dev` + curl (GET/POST/PATCH /comics jalan).
- Perintah: `pnpm --filter worker dev|build|test|lint`. Root `package.json` scripts (`dev`/`build`/`test`/`lint`) TETAP hanya target `web` — tidak diubah untuk mencakup worker.

Slice keempat (branch `feat/add-comic-and-recent-strip`, lanjutan): sambungkan `apps/web` ke `apps/worker` — data mock diganti fetch nyata.
- `apps/worker/src/index.ts`: tambah middleware `cors()` dari `hono/cors` (origin wildcard) — cukup untuk dev, belum ada auth/data sensitif nyata. TODO: persempit origin sebelum deploy production.
- API client baru `apps/web/src/lib/api/comics.ts`: `fetchComics()` (`GET /comics`) dan `postComic()` (`POST /comics`, otomatis set `status: "ongoing"` karena entry manual selalu ongoing). Base URL dari `import.meta.env.VITE_WORKER_URL`, fallback `http://localhost:8787`. Tipe env didefinisikan di `apps/web/src/vite-env.d.ts`; contoh env di `apps/web/.env.example`.
- **`lib/createComic.ts` DIHAPUS** — Worker sekarang generate `comic_id`/`created_at`/`updated_at` saat `POST /comics`, jadi logika itu jadi dead code di client. `NewComicInput` sekarang didefinisikan di `lib/api/comics.ts`.
- `routes/DaftarKomik.tsx`: `comics` state mulai dari `[]`, di-fetch via `useEffect` saat mount. State `loadStatus: "loading"|"ready"|"error"` dengan pesan error + tombol "Coba lagi". `handleAdd` sekarang `async`, panggil `postComic()` lalu prepend hasil server ke state — TIDAK ada optimistic UI (nunggu response selesai).
- `components/AddComicForm.tsx`: `onSubmit` sekarang `Promise<void>`, tombol submit disable + teks "Menyimpan…" selagi in-flight, error dari server ditampilkan lewat mekanisme error form yang sudah ada.
- Total test: `pnpm --filter web test` → 34 hijau (`lib/api/comics.test.ts` baru, `routes/DaftarKomik.test.tsx` baru, `createComic.test.ts` dihapus).
- Sudah diverifikasi end-to-end: `wrangler dev` (:8787) + `vite dev` (:5173) jalan bareng, tambah komik lewat UI browser tersimpan di Worker (dicek via curl), dan skenario Worker mati menampilkan pesan error yang jelas (bukan crash).

BELUM dibuat: wrapper Tauri & Capacitor, integrasi Langflow/Astra DB nyata, endpoint `/internal/tools/*`, auth token+KV, persistensi (localStorage untuk web kalau backend down, Astra DB untuk worker), `PATCH /comics/:id` belum dipanggil dari UI (endpoint Worker sudah ada, tapi belum ada tombol "update chapter" di frontend).

## Stack
- Frontend: React, dibungkus Tauri (desktop) & Capacitor (Android) — satu codebase
- Backend perantara: Cloudflare Worker
- Orkestrasi AI: Langflow (hosted di DataStax)
- Model AI: Google Gemini, API key milik masing-masing user (wajib diisi user sendiri, tidak dibagi bersama)
- Database: Astra DB (Cassandra-compatible)

## Prinsip Desain yang Sudah Diputuskan — Jangan Diubah Tanpa Konfirmasi User
- API key Google TIDAK PERNAH disimpan permanen di server manapun — hanya transit dari client per request
- AI agent TIDAK menentukan sendiri "entry baru vs update" berdasarkan reasoning bebas — wajib lewat tool `cari_komik_mirip` (fuzzy match deterministik di kode, bukan di reasoning LLM) sebelum tool create/update dipanggil
- Kalau skor kecocokan judul ambigu (beberapa kandidat berdekatan) — TIDAK auto-pilih, tampilkan ke user untuk konfirmasi
- Data komik dipartisi per user_id — tidak ada data yang dibagikan/terlihat antar user
- Rate-limit per user diberlakukan di level Worker
- Status 18+ adalah field terpisah `is_adult: boolean`, BUKAN varian dari tag jenis komik (pelajaran dari bug di aplikasi lama — lihat SPEC.md §8)
- Cover gambar: auto-fetch dari API publik (mis. MangaDex) dulu, fallback ke upload manual user kalau tidak ditemukan

## Halaman yang Harus Dibangun
1. **Halaman Daftar Komik** — grid/card visual (cover, judul, badge jenis, chapter terakhir, status, waktu update terakhir); sort, filter, search
2. **Halaman Tulis** — editor teks polos (hanya area editor, tanpa sidebar/tabs ala VS Code penuh), monospace, nomor baris, tombol kirim ke AI agent

## Format Data Historis (untuk parser & pemahaman format oleh Claude Code)
```
162. Judul komik(jenis) : ch11
172.Judul lain(2022)(manhwa):ch32
176.Judul(manga):ch38(completed)
```
Nomor urut di depan bukan id permanen. Kadang ada 2 grup kurung (tahun + jenis) — grup terakhir adalah jenis. Spasi sebelum `(`/`:` tidak konsisten antar baris. Status opsional menempel di akhir setelah nomor chapter. Chapter bisa desimal.

## Yang BELUM Diputuskan — Jangan Diasumsikan, Tanya User Dulu
- Skeleton kode Worker (bahasa/router: raw Fetch vs Hono)
- Definisi tool lengkap untuk Langflow (endpoint baru perlu dibuat: cari_komik_mirip, buat_entry_baru, update_chapter — siapa yang implementasi, di mana letaknya)
- Audit trail / undo untuk aksi AI
- Sumber auto-fetch cover pasti: MangaDex API langsung atau alternatif lain

## Responsif

Harus nyaman di HP, tablet, laptop. Desain mobile-first.

## Cara Kerja yang Diharapkan
- Baca PRD.md, SPEC.md, LANGFLOW_FLOW.md sebelum mulai fitur baru
- Kalau ketemu keputusan yang belum tercakup di dokumen ini, berhenti dan tanya user — jangan menebak arsitektur
- Update dokumen terkait kalau ada keputusan baru yang disepakati user selama sesi coding
- Untuk tugas apa pun yang lebih dari sepele: **rencana dulu, kode belakangan.**
   Tunggu saya setujui rencananya.
- Setelah selesai, beri tahu saya **cara memverifikasinya secara manual** —
   langkah konkret, bukan "silakan dicoba" jika memerlukan verifikasi secara manual oleh user, selain itu otomatis.
- Kalau saya tanya kenapa kamu menulis sesuatu, jelaskan sejujurnya. Termasuk
   kalau itu pilihan yang lemah.
- **PENTING: Setiap sesi selesai, perbarui file
   ini (CLAUDE.md) menyesuaikan format yang telah ada(jika ada). Ini menjaga CLAUDE.md tetap akurat sebagai single source of
   truth untuk apa yang sudah dikerjakan.

## Git Workflow

Setelah menyelesaikan setiap task atau perubahan yang diminta:

1. Pastikan seluruh perubahan telah selesai dan project tetap dapat dijalankan.
2. Jalankan lint, formatter, dan test yang tersedia.
3. Review kembali perubahan sebelum melakukan commit.
4. Buat commit dengan pesan yang jelas mengikuti Conventional Commits.
5. Push perubahan ke branch kerja (jangan langsung ke `main`).
6. Setelah push berhasil, buat Pull Request ke repository GitHub menggunakan GitHub CLI (`gh`) atau integrasi GitHub yang tersedia.
7. Isi Pull Request dengan:
   - Ringkasan perubahan
   - Alasan perubahan
   - Cara melakukan pengujian
   - Catatan tambahan jika ada
8. Setelah PR berhasil dibuat, tampilkan URL Pull Request kepada pengguna.

Jika pembuatan PR gagal karena izin, autentikasi, atau repository belum terhubung, hentikan proses tersebut dan jelaskan penyebabnya beserta langkah yang perlu dilakukan pengguna.

## Mandatory GitHub Pull Request

Setiap kali menyelesaikan implementasi fitur, bug fix, refactor, atau perubahan kode:

- Wajib membuat commit.
- Wajib melakukan push ke branch aktif.
- Wajib membuat Pull Request ke branch target menggunakan GitHub CLI (`gh pr create`) atau integrasi GitHub yang tersedia.
- Jangan menganggap pekerjaan selesai sampai Pull Request berhasil dibuat atau terdapat kegagalan yang tidak dapat diatasi (misalnya autentikasi atau permission).
- Jika gagal membuat PR, laporkan penyebabnya dan tampilkan perintah yang harus dijalankan pengguna.

# Review & Discussion Response Style

Ketika pengguna meminta review, evaluasi, pendapat, brainstorming, atau diskusi (dan TIDAK meminta implementasi), gunakan alur berikut secara konsisten.

## 1. Identifikasi jenis permintaan

Awali dengan menjelaskan jenis permintaan.

Contoh:

- This is a review/discussion request, not an implementation task.
- This is a design review request.
- This is an architectural discussion.
- This is a planning discussion.

Jangan langsung melakukan implementasi, menulis kode, ataupun membuat rencana implementasi kecuali diminta.

---

## 2. Jangan melakukan eksplorasi kode

Untuk request review atau diskusi:

- jangan membaca banyak file hanya untuk mencari jawaban,
- jangan mengubah kode,
- jangan membuat commit,
- jangan membuat Pull Request,
- gunakan informasi yang sudah diketahui dari konteks proyek.

Hanya eksplorasi kode bila pengguna secara eksplisit meminta investigasi.

---

## 3. Jika pengguna meminta penilaian beberapa opsi

Selalu gunakan tabel.

Gunakan format berikut.

| Item | Direkomendasikan? | Alasan |
|------|-------------------|--------|
| ... | Ya / Tidak / Nanti | alasan singkat |

Alasan cukup 1–3 kalimat.

Hindari paragraf panjang untuk setiap item.

---

## 4. Berikan rekomendasi yang tegas

Setelah tabel, selalu buat bagian rekomendasi.

Format:

- kandidat terbaik dikerjakan sekarang
- kandidat yang sebaiknya ditunda
- kandidat yang sebaiknya dihindari
- alasan prioritas

Jangan hanya menjelaskan pro dan kontra tanpa mengambil kesimpulan.

---

## 5. Pertimbangkan dampak teknis

Saat memberi penilaian, pertimbangkan:

- kompleksitas implementasi
- perubahan arsitektur
- risiko bug
- dampak terhadap UX
- maintenance jangka panjang
- konsistensi dengan scope proyek
- effort vs value

Jelaskan secara ringkas.

---

## 6. Gunakan bahasa yang ringkas

Target:

- langsung ke inti
- bullet point bila perlu
- tabel untuk perbandingan
- hindari penjelasan berulang
- hindari paragraf yang terlalu panjang

Jawaban review harus mudah dipindai (scannable).

---

## 7. Jangan berubah menjadi implementasi

Review tetap review.

Jangan:

- menulis kode
- membuat pseudocode
- membuat TODO implementasi
- mengubah file
- membuat patch

Kecuali pengguna secara eksplisit meminta langkah implementasi.

---

## 8. Tutup dengan rekomendasi akhir

Akhiri dengan satu paragraf yang berisi keputusan akhir.

Contoh gaya:

- Jika hanya memilih satu fitur berikutnya, saya merekomendasikan ...
- Saya tidak menyarankan mengerjakan ... sekarang karena ...
- Setelah fitur ... selesai, baru pertimbangkan ...
- Urutan prioritas yang saya rekomendasikan adalah ...

Jawaban harus berakhir dengan rekomendasi yang jelas, bukan hanya analisis.

## Review Philosophy

Saat melakukan review:

- Bertindak sebagai senior software engineer yang sedang melakukan design review.
- Jangan hanya menjawab pertanyaan pengguna; lakukan evaluasi kritis.
- Berani mengatakan suatu ide tidak layak apabila memang memiliki biaya implementasi yang lebih besar daripada manfaatnya.
- Prioritaskan kesederhanaan, maintainability, dan konsistensi arsitektur dibanding menambah fitur.
- Jika terdapat satu opsi yang jelas lebih baik, rekomendasikan opsi tersebut secara eksplisit.
- Hindari jawaban yang terlalu diplomatis seperti "semuanya tergantung kebutuhan" apabila terdapat rekomendasi teknis yang lebih masuk akal.

# Failure Handling & Recovery Policy

Apabila suatu pekerjaan tidak dapat diselesaikan karena keterbatasan environment, tooling, permission, jaringan, autentikasi, atau keterbatasan Claude Code, jangan berhenti hanya dengan menampilkan error.

Selalu lakukan langkah berikut.

## 1. Identifikasi penyebab

Jelaskan secara spesifik:

- apa yang gagal
- pada langkah mana gagal
- penyebab paling mungkin
- apakah penyebab berasal dari:
  - tooling
  - permission
  - environment
  - dependency
  - konfigurasi
  - bug aplikasi
  - atau faktor eksternal

Jangan hanya menampilkan pesan error mentah.

---

## 2. Tentukan apakah dapat diperbaiki otomatis

Jika dapat diperbaiki sendiri:

- lakukan perbaikan
- ulangi proses

Jangan meminta bantuan user.

---

## 3. Jika membutuhkan tindakan manual

Jika memang membutuhkan tindakan pengguna, tampilkan:

### Manual Action Required

berisi langkah-langkah yang harus dilakukan user secara berurutan.

Contoh:

1. Login ulang GitHub CLI
2. Jalankan `gh auth login`
3. Pilih HTTPS
4. Verifikasi akun
5. Jalankan kembali task

---

## 4. Berikan alasan

Setelah langkah manual, jelaskan:

- mengapa langkah tersebut diperlukan
- mengapa Claude tidak dapat melakukannya sendiri
- keterbatasan apa yang sedang terjadi

---

## 5. Berikan dampak

Jelaskan:

- apakah pekerjaan sudah aman
- apakah data berubah
- apakah perubahan sudah tersimpan
- apakah user bisa melanjutkan tanpa kehilangan pekerjaan

---

## 6. Berikan langkah selanjutnya

Selalu akhiri dengan:

Next Action

berisi satu tindakan yang paling direkomendasikan setelah user selesai melakukan langkah manual.

---

## 7. Format jawaban

Gunakan format berikut.

❌ Problem

...

🔍 Cause

...

✅ Automatic Recovery

...

👤 Manual Action Required

1.
2.
3.

💡 Why

...

➡ Next Action

...

## Error Classification

Kelompokkan setiap kegagalan ke salah satu kategori berikut.

- Tool Limitation
- Environment Limitation
- Permission Issue
- Authentication Issue
- Dependency Issue
- Configuration Issue
- Build Error
- Runtime Error
- Test Failure
- Lint Failure
- Browser Automation Failure
- Unknown

Gunakan kategori tersebut saat menjelaskan penyebab.

Claude tidak boleh mengakhiri pekerjaan hanya dengan menampilkan error.

Sebelum mengakhiri respons, Claude WAJIB memberikan:

- diagnosis
- penyebab
- solusi otomatis yang sudah dicoba
- solusi manual jika diperlukan
- alasan mengapa solusi manual diperlukan
- langkah berikutnya

Apabila tidak ada solusi yang diketahui, jelaskan secara eksplisit mengapa tidak ada solusi yang dapat diberikan.
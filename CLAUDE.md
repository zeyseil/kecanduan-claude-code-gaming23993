# CLAUDE.md — Konteks Proyek untuk Claude Code

## Ringkasan Proyek
Aplikasi personal pencatat komik terbaca, dibungkus untuk Desktop (Tauri) dan Android (Capacitor), dengan fitur AI agent yang mengotomasi pencatatan dari input teks bebas. Lihat `PRD.md`, `SPEC.md`, dan `TOOL_CONTRACTS.md` di root repo untuk detail keputusan produk dan arsitektur — baca semuanya sebelum mengerjakan fitur baru. (`LANGFLOW_FLOW.md` sudah dihapus — orkestrasi Langflow diganti Gemini function calling di dalam Worker, arsip di branch `archive/langflow-orchestration`.)

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

Slice kelima (branch `feat/add-comic-and-recent-strip`, lanjutan): tombol "Update chapter" di UI, memanggil `PATCH /comics/:id`. Scope sengaja dibatasi ke field `latest_chapter` saja.
- `apps/web/src/lib/api/comics.ts`: tambah `patchComic(id, { latest_chapter })` — mirror pola `postComic`/`fetchComics`.
- `components/ComicCard.tsx`: prop `onUpdateChapter?` (opsional — kalau tidak diisi, tombol disembunyikan; dipakai supaya `RecentStrip` tetap tidak punya tombol update). Tombol "Update chapter" selalu tampil (bukan hover-only) di footer card, supaya nyaman diakses di HP.
- `components/ComicGrid.tsx`: prop `onUpdateChapter` (wajib) diteruskan ke tiap `ComicCard`.
- `components/UpdateChapterForm.tsx` (baru): form kecil satu input angka, default value dari chapter saat ini, validasi/error/disable-saat-submit mirror `AddComicForm.tsx`.
- `routes/DaftarKomik.tsx`: state `editingComic: Comic | null`; modal baru (pola sama seperti modal tambah komik) muncul saat `editingComic` terisi; `handleChapterSubmit` panggil `patchComic()` lalu replace comic yang cocok di state — TIDAK ada optimistic UI.
- Total test: `pnpm --filter web test` → 44 hijau (`patchComic` di `comics.test.ts`, `ComicCard.test.tsx` tombol, `UpdateChapterForm.test.tsx` baru, alur update di `DaftarKomik.test.tsx`).
- Sudah diverifikasi end-to-end di browser: tambah komik → klik "Update chapter" → ubah angka → submit → kartu ter-update tanpa reload, tersimpan di Worker (dicek via curl). Skenario Worker mati: modal tetap terbuka dengan pesan error, comic di grid tidak berubah.

Slice keenam (branch `feat/add-comic-and-recent-strip`, lanjutan): ganti storage in-memory Worker dengan **Astra DB nyata**, pakai **Astra Data API** (HTTP/JSON, bukan CQL driver — driver Cassandra native tidak jalan baik di runtime Cloudflare Workers). Scope dibatasi ke collection `comics` saja — table `process_log` (audit trail, SPEC.md §9) DITUNDA ke task terpisah.
- Dependency baru: `@datastax/astra-db-ts` (runtime dep), `tsx` (devDep, untuk jalankan script sekali-jalan).
- `apps/worker/src/env.ts` (baru): interface `Env` (`ASTRA_DB_API_ENDPOINT`, `ASTRA_DB_APPLICATION_TOKEN`, `ASTRA_DB_COLLECTION`), dipakai sebagai `Hono<{ Bindings: Env }>` di `index.ts` dan `routes/comics.ts`.
- Storage dipecah jadi abstraksi `ComicRepository` (`apps/worker/src/store/comicRepository.ts`, interface 4 method async) dengan dua implementasi: `astraComicRepository.ts` (nyata, pakai `astraClient.ts` → `getCollection(env)` bikin `DataAPIClient` per-panggilan, TIDAK di-cache di module scope) dan `inMemoryComicRepository.ts` (test-only, menggantikan `resetStore()` lama via `resetInMemoryStore()`).
- `comicStore.ts` sekarang factory tipis: `getComicStore(env: Env): ComicRepository` → selalu resolve ke Astra di runtime nyata. Semua fungsi jadi **async** — `routes/comics.ts` sekarang `await` tiap panggilan store dan pass `c.env`.
- Trade-off yang dicatat: Astra Data API menyimpan dokumen di collection (schemaless), BUKAN CQL table dengan partition/clustering key literal seperti draf skema SPEC.md §5 — `user_id` jadi filter field biasa per dokumen, bukan partition key fisik. Untuk skala aplikasi ini (single demo user) tidak masalah, tapi ini penyimpangan yang disengaja dari SPEC.md.
- `comic_id` TETAP field aplikasi terpisah (UUID via `crypto.randomUUID()`, sama seperti sebelumnya) — TIDAK memakai `_id` bawaan Astra, supaya tipe `Comic` identik antara `apps/web` dan `apps/worker` tanpa bocornya konsep Astra ke frontend.
- Kredensial: `apps/worker/.dev.vars.example` (di-commit, placeholder) → user copy jadi `.dev.vars` (gitignored, isi kredensial asli sendiri — Claude tidak pernah mengisi token). Root `.gitignore` ditambah `.dev.vars`/`.dev.vars.*` (kecuali `.dev.vars.example`). Untuk prod: `wrangler secret put ASTRA_DB_API_ENDPOINT|ASTRA_DB_APPLICATION_TOKEN|ASTRA_DB_COLLECTION` (dijalankan user sendiri).
- `apps/worker/scripts/create-collection.ts` (baru, script `pnpm --filter worker run create-collection`): bikin collection Astra sekali kalau belum ada — sengaja TIDAK dipanggil otomatis dari Worker (bukan bagian hot path request).
- `apps/worker/README.md` (baru): dokumentasi setup Astra DB lokal + deploy.
- Test: `comicStore.test.ts` sekarang pakai `inMemoryComicRepository` langsung (tanpa network). `routes/comics.test.ts` mock module `@datastax/astra-db-ts` via `vi.mock` (fake `DataAPIClient`/collection in-memory) — jadi `comicStore`/`astraComicRepository`/`routes/comics.ts` tetap diuji beneran, hanya boundary network yang di-stub. Total tetap `pnpm --filter worker test` → 13 hijau.
- Sudah diverifikasi end-to-end dengan Astra DB sungguhan (kredensial user sendiri): create-collection, POST/GET/PATCH via curl, restart `wrangler dev` lalu data masih ada.

Slice ketujuh (branch `feat/add-comic-and-recent-strip`, lanjutan): Edit komik penuh dari UI (title, type_tag, is_adult, latest_chapter, cover_url re-crop) + delete, menggantikan tombol "Update chapter" yang cuma edit chapter. Trigger lewat interaksi tap/klik card yang memunculkan efek spotlight (bukan tombol permanen di card).
- Worker: `ComicRepository` (`apps/worker/src/store/comicRepository.ts`) dapat method baru `deleteComic(userId, comicId): Promise<boolean>`, diimplementasi di `inMemoryComicRepository.ts` (splice array) dan `astraComicRepository.ts` (`collection.deleteOne`). Route baru `DELETE /comics/:id` di `apps/worker/src/routes/comics.ts` (404 kalau tidak ada, 204 kalau sukses).
- `apps/web/src/lib/api/comics.ts`: `patchComic`'s tipe patch diperluas jadi `ComicPatch` (semua field editable, semua optional), tambah `deleteComic(id)` → `DELETE /comics/:id`.
- `apps/web/src/components/UpdateChapterForm.tsx` **DIHAPUS**, diganti `EditComicForm.tsx` — field lengkap meniru `AddComicForm.tsx` (termasuk upload+crop cover pakai `ImageCropModal`/`lib/cropImage.ts` yang sudah ada), plus delete inline: klik "Hapus" → isi form diganti sementara jadi konfirmasi `Yakin hapus "{title}"?` + tombol "Ya, hapus"/"Batal" (state lokal `confirmingDelete`, bukan modal terpisah).
- `apps/web/src/components/ComicCard.tsx`: tombol "Update chapter" yang selalu tampil DIHAPUS total, diganti interaksi **press-to-reveal**: klik area kosong card → `onPress?.(comic_id)` → kalau `isPressed`, card scale up (`scale-105`) + glow (`shadow-glow animate-glow-pulse`, keyframes baru di `tailwind.config.js`) + icon edit kecil (inline SVG, pojok kanan-bawah cover) muncul; kalau `isDimmed` (ADA card lain yang pressed), card ini `opacity-40 blur-[1px] pointer-events-none`. Semua props (`isPressed`/`isDimmed`/`onPress`/`onEdit`) opsional — `RecentStrip` tidak diubah, otomatis tanpa interaksi apa pun (tidak pass props ini).
- `apps/web/src/components/ComicGrid.tsx`: terima `pressedComicId`/`onPress`/`onEdit`, teruskan ke tiap `ComicCard`; render overlay tak-terlihat (`fixed inset-0 z-0`, hanya saat ada card pressed) untuk menangani klik-di-luar-card → reset.
- `apps/web/src/routes/DaftarKomik.tsx`: state `pressedComicId` baru; `editingComic` sekarang dipakai khusus modal Edit (bukan trigger tap). `handleEditSubmit`/`handleDelete` panggil `patchComic`/`deleteComic` lalu update/filter state `comics` — tidak ada optimistic UI (pola sama seperti slice sebelumnya).
- Interaksi sama di desktop & mobile (klik/tap, bukan hover-only) — tidak ada pemisahan breakpoint untuk trigger ini. Efek dim+blur hanya ke card lain di grid (header/search bar/RecentStrip tetap normal).
- Total test: `pnpm --filter worker test` → 17 hijau (+4 test delete). `pnpm --filter web test` → 49 hijau (`EditComicForm.test.tsx` baru gantikan `UpdateChapterForm.test.tsx`, `ComicCard.test.tsx`/`DaftarKomik.test.tsx`/`lib/api/comics.test.ts` diperbarui untuk alur edit+delete baru).
- Sudah diverifikasi end-to-end di browser (dengan Astra DB sungguhan): klik card → spotlight+icon edit muncul → klik icon → modal Edit terisi data comic → ubah title/chapter/18+ → Simpan → grid ter-update tanpa reload, tersimpan di Astra DB (dicek via curl). Delete: klik "Hapus" → konfirmasi tampil → "Batal" kembali ke form (belum terhapus) → "Hapus" lagi → "Ya, hapus" → comic hilang dari grid dan Astra DB. Klik di luar card mereset spotlight (dites lewat DOM state, bukan visual).
- Catatan: `.claude/launch.json` ditambah config `worker` (port 8787) di samping `web` yang sudah ada, supaya preview browser bisa jalankan kedua server.

Slice kedelapan (branch `feat/add-comic-and-recent-strip`, lanjutan): backend nyata untuk AI agent — endpoint `/internal/tools/*`, JSON flow Langflow siap-import, dan `/agent/process` yang benar-benar memanggil Langflow API (bukan stub 501 lagi). Halaman Tulis (UI) BELUM disambungkan — diverifikasi lewat curl saja. Ikuti `TOOL_CONTRACTS.md`/`LANGFLOW_FLOW.md` persis, dengan dua penyesuaian scope yang disepakati user lewat interview: `log-process` diimplementasi **penuh** (bukan stub) dan `fetch-cover` pakai **Durable Object** throttle (bukan di-skip).
- `apps/worker/src/env.ts`: tambah `PROCESS_LOG_COLLECTION`, `INTERNAL_TOOLS_SECRET`, `LANGFLOW_API_URL`, `LANGFLOW_API_KEY`, `RATE_LIMITER` (Durable Object binding). `.dev.vars.example` & `wrangler.toml` (`[[durable_objects.bindings]]` + `[[migrations]]`) diupdate mengikuti.
- `apps/worker/src/store/fuzzyMatch.ts` (baru): normalisasi judul (lowercase, strip tanda baca, collapse spasi) + token-sort Levenshtein similarity ratio, deterministik di kode — bukan reasoning LLM (prinsip wajib LANGFLOW_FLOW.md). `ComicRepository` (interface + inMemory + astra) dapat method baru `searchComics(userId, candidateTitle)` yang reuse helper ini, maks 5 kandidat urut skor tertinggi, skor diambil dari title ATAU aliases (mana yang lebih tinggi).
- `apps/worker/src/store/processLogRepository.ts` + `astraProcessLogRepository.ts` + `inMemoryProcessLogRepository.ts` + `processLogStore.ts` (baru, pola identik `comicRepository`/`comicStore`): audit trail `process_log` sungguhan (bukan stub), collection Astra terpisah lewat `env.PROCESS_LOG_COLLECTION`. `apps/worker/src/types/processLog.ts` (baru): `AiAction = "created"|"updated"|"ambiguous"`. `scripts/create-collection.ts` diperluas jadi bikin 2 collection (`comics` + `process_log`).
- `apps/worker/src/durable-objects/RateLimiter.ts` (baru): token-bucket in-memory (5 token, refill 5/detik), instance tunggal (`idFromName("mangadex")`), method `fetch()` menunggu (bukan gagal) kalau bucket kosong. Diekspor dari `index.ts` (wajib untuk binding Durable Object) + didaftarkan di `wrangler.toml`.
- `apps/worker/src/middleware/internalAuth.ts` (baru): guard bersama untuk semua `/internal/tools/*` — cek header `X-Internal-Secret` cocok `env.INTERNAL_TOOLS_SECRET` (401 kalau tidak) dan `X-User-Id` ada (400 kalau tidak, di-`c.set()` untuk dipakai handler). Ini BEDA pola dari `comics.ts` yang masih pakai `DEMO_USER_ID` hardcode — tools baru menerima `user_id` dari Langflow lewat `tweaks`, bukan dari browser.
- `apps/worker/src/routes/internalTools.ts` (baru, 5 endpoint sesuai TOOL_CONTRACTS.md §2): `POST /find-similar`, `/create-comic` (field request `chapter`→disimpan sebagai `latest_chapter`, `status: null`→default `"ongoing"`), `/update-chapter` (balas `previous_chapter`, 404 kalau comic tidak ada), `/fetch-cover` (panggil `acquireMangaDexSlot()` dulu baru fetch MangaDex publik lewat `apps/worker/src/lib/mangadex.ts` baru — cari manga by title, ambil `cover_art` relationship, susun URL `uploads.mangadex.org`; balas `cover_url: null` kalau tidak ketemu, tidak throw), `/log-process` (validasi lalu `processLogStore.insertLog()`). Status code & skema error TIDAK didefinisikan di TOOL_CONTRACTS.md — diputuskan ikuti pola existing `comics.ts` (`c.json({error}, 4xx)`, 200 sukses, 401 secret invalid). Didaftarkan di `index.ts`: `app.route("/internal/tools", internalTools)`.
- `apps/worker/src/routes/agent.ts`: `Hono()` → `Hono<{ Bindings: Env }>()`, `/process` sekarang benar-benar `fetch()` ke `${LANGFLOW_API_URL}` (body `input_value`/`input_type`/`output_type`/`tweaks`, header `x-api-key`). `tweaks` di-target lewat component id tetap (`Agent-gemini` dapat `{api_key: google_api_key user}`; 5 `Tool-*` masing-masing dapat `{internal_secret, user_id: "demo-user"}`) — id ini HARUS sinkron dengan `langflow/comic-tracker-flow.json`, kalau id komponen diubah manual di Langflow UI maka `TOOL_COMPONENT_IDS`/`AGENT_COMPONENT_ID` di `agent.ts` wajib diupdate juga. Error fetch (network/timeout) atau response non-OK dari Langflow → `502`, bukan crash.
- `apps/worker/langflow/comic-tracker-flow.json` + `README.md` (baru): JSON flow siap-import (Chat Input → Agent Google Generative AI tool-calling → 5 Tool component → Chat Output). **Ditandai eksplisit sebagai scaffold best-effort** — skema internal node Langflow version-dependent, saya tidak punya akses instance Langflow nyata untuk verifikasi langsung import. README berisi fallback: kode Python lengkap tiap 5 Tool component (`tool_mode=True`, HTTP POST ke `/internal/tools/*` masing-masing) + system prompt Agent lengkap (rules: wajib cari_komik_mirip dulu, larang auto-pilih ambigu, larang gabung is_adult ke type_tag, wajib log_proses di semua cabang), untuk dibangun manual di UI Langflow kalau import JSON gagal di versi Langflow user.
- Total test: `pnpm --filter worker test` → 45 hijau (`fuzzyMatch.test.ts`, `inMemoryProcessLogRepository.test.ts`, `internalAuth.test.ts`, `internalTools.test.ts`, `RateLimiter.test.ts` baru; `agent.test.ts` diperbarui — stub 501 diganti mock `fetch` global ke Langflow, cek tweaks yang dikirim). `pnpm --filter worker lint` dan `build` bersih.
- Kredensial (`INTERNAL_TOOLS_SECRET`, `LANGFLOW_API_URL`, `LANGFLOW_API_KEY`, `PROCESS_LOG_COLLECTION`) diisi user sendiri lewat `.dev.vars` — tidak pernah diisi Claude.
- **Sudah diverifikasi end-to-end dengan Langflow sungguhan** (user build manual di Langflow UI, project "komik-tracker" flow "yay", JSON scaffold `comic-tracker-flow.json` TIDAK berhasil diimpor langsung — user pakai fallback build manual dari README). Tiga bug nyata ditemukan & diperbaiki selama proses ini (detail di slice kesembilan): `tool_mode` harus di level Input bukan Component, field `status` reserved word, field `user_id` di-override diam-diam oleh Langflow.

Slice kesembilan (branch `feat/add-comic-and-recent-strip`, lanjutan): sambungkan halaman Tulis (UI) ke `/agent/process` sungguhan + fix bug upload cover manual yang ditemukan user saat testing.

**Fix bug upload cover manual** (root cause: limit index Astra, bukan limit dokumen umum):
- `apps/web/src/lib/cropImage.ts`: `getCroppedImageDataUrl` sekarang downscale — cap `MAX_COVER_WIDTH = 800`px, proporsional untuk crop lebih lebar dari itu (tidak diubah untuk crop yang sudah kecil).
- `apps/worker/src/routes/comics.ts`: `store.insertComic()`/`store.updateComic()` dibungkus try/catch, balas `c.json({error: "Gagal menyimpan komik: " + pesan}, 500)` alih-alih biarkan exception Astra jadi 500 generik tanpa body — ini yang membongkar root cause asli saat ditest.
- **Root cause asli** (ditemukan lewat testing manual user + `javascript_tool` di browser, BUKAN limit ~1MB dokumen umum yang tadinya diduga): Astra Data API punya limit ketat **8000 byte untuk field yang di-index** (`Document size limitation violated: indexed String value (field 'cover_url') ... exceeds maximum allowed (8000 bytes)`). Semua field di-index by default kecuali collection dibuat dengan opsi `indexing: {deny: [...]}` — downscale 800px SAJA tidak cukup (base64 JPEG cover buku realistis masih puluhan-ratusan KB).
- Fix sebenarnya: `apps/worker/scripts/create-collection.ts` sekarang buat collection `comics` dengan `indexing: {deny: ["cover_url"]}` (collection baru/fresh setup langsung benar). Untuk collection existing (Astra tidak bisa ubah indexing collection yang sudah ada) — `apps/worker/scripts/migrate-cover-index.ts` (baru): script migrasi export→drop→recreate→restore, **aman dijalankan tanpa flag** (cuma backup ke `apps/worker/backup-comics-<timestamp>.json`, gitignored — lihat `.gitignore` baris `apps/worker/backup-*.json`), perlu flag `--confirm` eksplisit untuk benar-benar drop+recreate+restore. Sudah dijalankan sungguhan terhadap Astra DB user (5 dokumen), diverifikasi data utuh setelah migrasi + cover 2MB berhasil tersimpan (201) setelahnya.
- Test baru: `cropImage.test.ts` (downscale proporsional + no-op untuk crop kecil), `comics.test.ts` (worker, error message jelas saat store gagal untuk POST/PATCH).

**Sambungkan Tulis ke `/agent/process`:**
- `apps/web/src/lib/api/comics.ts`: `errorMessage()` jadi exported (di-reuse, hindari duplikasi).
- `apps/web/src/lib/api/agent.ts` (baru): `processAgentText({teks_input, google_api_key})`, pola persis `postComic()`. Return type `unknown` — bentuk balasan Langflow (`outputs`/`session_id`) version-dependent, tidak diasumsikan stabil.
- `apps/web/src/lib/storage.ts` (baru, localStorage helper pertama di codebase): `getGoogleApiKey()`/`setGoogleApiKey()`, key `komik-tracker:google-api-key`. Pakai `globalThis.localStorage` (bukan `window.localStorage`/`localStorage` polos) — ditemukan Node 26 di environment ini bentrok dengan `localStorage` bawaan jsdom 25, testnya stub `localStorage` sendiri via `vi.stubGlobal` (pola sama seperti stub `fetch`) daripada bergantung pada implementasi asli.
- `apps/web/src/routes/Tulis.tsx`: rewrite total — input API key Gemini (`type="password"`, persist ke localStorage tiap ketik, link ke aistudio.google.com/apikey), state `status: idle|processing|success|error`, `handleProcess` validasi API key dulu (kalau kosong: error tanpa fetch) lalu panggil `processAgentText()`, hasil ditampilkan pretty-printed JSON mentah (bentuk `outputs` tidak stabil, tidak coba diparse rapi).
- `apps/web/src/components/TextEditor.tsx`: tambah prop `disabled?: boolean` (dari `status === "processing"` di Tulis), tombol berubah teks "Memproses…" saat disabled.
- Test baru: `agent.test.ts`, `storage.test.ts`, `Tulis.test.tsx` (3 skenario: API key kosong, sukses, error).
- Total test: `pnpm --filter web test` → 58 hijau. `pnpm --filter worker test` → 47 hijau. Lint+build kedua app bersih.
- **Sudah diverifikasi end-to-end di browser nyata**: isi API key (fake, sengaja untuk test wiring) → submit → tombol "Memproses…" → request masuk log Worker → forward ke Langflow (~50 detik, real network) → Langflow tolak (API key fake) → UI tampilkan pesan error jelas (bukan crash/layar putih). Wiring request/response, loading state, dan error handling semua terbukti jalan; hanya belum ditest dengan API key Gemini asli dalam sesi ini (user perlu isi sendiri).
- `.claude/launch.json`: `runtimeExecutable` diganti dari `corepack` ke `npx` (dengan arg `--yes`) — `corepack` tidak tersedia di environment Claude Code sesi ini meski disebut di dokumentasi lama, `npx pnpm@9.15.9` jadi fallback yang terbukti jalan.

Slice kesepuluh (branch `feat/add-comic-and-recent-strip`, lanjutan): verifikasi manual slice kesembilan dengan API key Gemini asli menemukan 1 bug nyata + 3 perbaikan UX yang diminta user, semuanya digabung ke satu PR (keputusan user lewat interview, bukan dipisah per-slice).
- **Bug ditemukan dari raw JSON hasil test**: `log_process_tool` gagal `400 Bad Request` karena Agent Langflow mengirim `ai_action: "update_chapter"` (nama tool), padahal `apps/worker/src/types/processLog.ts` (`AI_ACTIONS`) hanya menerima string persis `"created"|"updated"|"ambiguous"`. Root cause di system prompt Agent, BUKAN kode Worker (validasi Worker sudah benar sesuai TOOL_CONTRACTS.md). Fix: `apps/worker/langflow/README.md` — system prompt contoh diperjelas dengan instruksi eksplisit nilai literal `ai_action` yang diterima. **Aksi manual user (belum dilakukan)**: update system prompt Agent sungguhan di Langflow UI sesuai README baru — bug ini masih terjadi di instance Langflow user sampai prompt-nya diupdate manual.
- **Output AI di halaman Tulis** (`routes/Tulis.tsx`): tidak lagi tampilkan JSON mentah sebagai UI utama. Helper baru `lib/parseAgentResult.ts` (`extractAgentMessage`) men-drill defensif ke `outputs[0].outputs[0].outputs.message.message` (path stabil dari Chat Output Langflow, dikonfirmasi dari raw JSON asli user) — return `null` kalau bentuk tak dikenal (tidak crash, fallback ke tampilan JSON). Detail JSON tetap ada lewat elemen native `<details>` collapsible (tidak dihapus, untuk debugging).
- **Nama komik panjang di card** (`components/ComicCard.tsx`): sudah punya `line-clamp-2` (Tailwind 3.4.15 built-in, tanpa plugin) + native `title` attribute tooltip — sesuai opsi yang dipilih user ("truncate + tooltip"), **tidak ada perubahan kode** (sudah sesuai sebelum slice ini, hanya dikonfirmasi lewat interview+baca kode).
- **Search jadi command palette** (gaya Ctrl+K seperti Claude Desktop, scope: cari komik existing saja, bukan navigasi global): komponen baru `components/SearchPalette.tsx` (modal, live filter pakai `selectComics` dari `lib/comicList.ts` yang sudah ada, klik hasil → buka modal Edit lewat `handleEditOpen` yang sudah ada). `components/Toolbar.tsx`: input search dihapus, diganti tombol "Cari judul… (Ctrl K)" yang membuka palette. `routes/DaftarKomik.tsx`: state `showSearchPalette` + global keydown listener `Ctrl+K`/`Cmd+K` (`e.preventDefault()`). Efek samping: `RecentStrip` sekarang selalu tampil (sebelumnya disembunyikan saat `options.search` terisi dari input lama) karena search tidak lagi memfilter grid utama, murni untuk lompat ke comic lewat palette — filter jenis/status/sort di Toolbar tidak berubah.
- Total test: `pnpm --filter web test` → 64 hijau (`parseAgentResult.test.ts` baru, `SearchPalette.test.tsx` baru, `Tulis.test.tsx`/`DaftarKomik.test.tsx` diperbarui). `pnpm --filter worker test` tetap 47 hijau (tidak ada perubahan kode Worker, cuma dokumentasi README). Lint+build web bersih.
- **Sudah diverifikasi end-to-end di browser nyata** (dev server sudah berjalan dari sesi user sebelumnya, dipakai langsung, bukan instance baru): (1) Tulis dengan API key Gemini asli yang sudah tersimpan → submit teks update → pesan human-readable tampil ("Chapter untuk komik \"Solo Leveling\" telah berhasil diperbarui menjadi chapter 50."), detail JSON tetap bisa dibuka — DAN mengonfirmasi ulang bug `ai_action` masih terjadi (400) karena system prompt Langflow user belum diupdate manual. (2) Search palette: Ctrl+K/klik tombol → modal muncul → ketik → hasil live ter-filter → klik hasil → modal Edit terbuka dengan comic yang benar. (3) Skenario ambiguous **belum berhasil dipicu** — komik dummy "Solo Leveling: Ragnarok" (skor 0.59) dibuat untuk uji coba, tapi gap ke "solo leveling" (skor 1.0, exact match) adalah 0.41 — jauh di atas threshold ambigu 0.15 di system prompt, jadi Agent benar mengeksekusi update otomatis (bukan bug, sesuai aturan yang didokumentasikan). Komik dummy sudah dihapus lagi setelah test. **Catatan untuk user**: untuk memicu ambiguous sungguhan, butuh 2 judul existing yang skor fuzzy-nya berdekatan (selisih < 0.15) satu sama lain relatif terhadap judul yang diketik user — judul yang PERSIS sama dengan salah satu (skor 1.0) hampir tidak mungkin ambigu karena gap ke kandidat lain biasanya besar; coba dua judul yang SAMA-SAMA mirip tapi tidak ada yang exact match ke teks yang diketik.

Slice kesebelas (branch `feat/add-comic-and-recent-strip`, lanjutan, PR #12): user sudah update system prompt Langflow manual (fix bug `ai_action`) — verifikasi ulang lewat browser + audit kesiapan Langflow hosted DataStax untuk production + auth token+KV per user, tiga tahap berurutan sesuai rencana yang disetujui user.

**Tahap 1 — Verifikasi Tulis dengan fix `ai_action`:** Browser nyata + Astra DB nyata. Input "baru baca berserk ch57" (comic existing, chapter 56→57) → sukses, pesan human-readable tampil benar, TIDAK ada lagi error 400 dari `log_process_tool`. Cek Astra: `comic_id` sama (update, bukan entry baru). Bug dari slice kesepuluh **terbukti fix**. Skenario ambiguous di-skip atas keputusan user (data existing tidak cukup berdekatan skornya, user tidak mau bikin dummy comic lagi).

**Tahap 2 — Audit kesiapan Langflow hosted (DataStax):** Scope dipersempit lewat interview user — TIDAK ada perubahan arsitektur hosting (Worker/web app tetap di Cloudflare, tidak pindah ke DataStax). Murni audit dokumentasi Langflow untuk multi-user. Ketemu 1 bug dokumentasi nyata: `apps/worker/langflow/README.md` baris 30 (bagian "Tweaks yang dikirim") masih menyebut field `user_id`, padahal kode asli `agent.ts:50` dan penjelasan lain di README yang sama sudah benar pakai `app_user_id` (Langflow silently override field bernama persis `user_id` — lihat catatan di slice kedelapan). Field yang sama juga stale di 5 tempat `comic-tracker-flow.json` (scaffold JSON yang gagal diimpor user, tapi diperbaiki untuk konsistensi kalau dicoba lagi di versi Langflow lain). Tidak ada perubahan arsitektur/kode Worker di tahap ini.

**Tahap 3 — Auth token+KV per user:** Ganti `DEMO_USER_ID` hardcode dengan token custom sederhana (bukan OAuth/email-password — keputusan user lewat interview: skala kecil, pemilik + beberapa teman, provisioning token manual oleh pemilik, bukan self-register).
- Worker: `apps/worker/src/middleware/userAuth.ts` (baru) — cek header `Authorization: Bearer <token>`, lookup ke KV `AUTH_TOKENS` (token → `user_id` bebas), 401 kalau token kosong/tidak valid. Terpisah dari `internalAuth.ts` (concern beda: itu Langflow↔Worker pakai shared secret, ini browser↔Worker pakai token per-user) — `internalAuth.ts` TIDAK disentuh.
- `apps/worker/src/env.ts` + `wrangler.toml`: binding KV baru `AUTH_TOKENS` (id masih placeholder `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` di `wrangler.toml` — user wajib jalankan `wrangler kv namespace create AUTH_TOKENS` sendiri dan isi id-nya, langkah ini BELUM dilakukan user untuk environment production).
- `apps/worker/src/routes/comics.ts`: `DEMO_USER_ID` dihapus total, middleware `userAuth` dipasang di semua route (`comics.use("*", userAuth)`), semua akses store pakai `c.get("userId")`.
- `apps/worker/src/routes/agent.ts`: `/process` dilindungi `userAuth`, `app_user_id` di tweaks Langflow sekarang dari `c.get("userId")` (token user sungguhan) — bukan konstanta lagi, jadi `process_log`/`comics` yang dibuat lewat AI agent otomatis ikut partisi user yang benar.
- Tidak ada endpoint register — provisioning token murni manual: `wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>"`, didokumentasikan di `apps/worker/README.md` bagian baru "Setup Auth (token per user)" (termasuk cara pakai `--local` untuk dev dan cara mencabut akses via `kv key delete`).
- Frontend: `apps/web/src/lib/api/client.ts` (baru) — `apiFetch()` wrapper bersama, attach `Authorization` header dari `lib/storage.ts` (fungsi baru `getAuthToken`/`setAuthToken`/`clearAuthToken`, key `komik-tracker:auth-token`), auto-clear token + `location.href = "/login"` saat response 401. Dipakai ulang oleh SEMUA 5 fungsi fetch existing (`fetchComics`/`postComic`/`patchComic`/`deleteComic` di `comics.ts`, `processAgentText` di `agent.ts`) — mengurangi duplikasi yang sebelumnya tiap fungsi punya `fetch()` sendiri-sendiri.
- `apps/web/src/routes/Login.tsx` (baru, halaman penuh sesuai pilihan user — bukan modal): satu input token, submit → `setAuthToken()` → redirect ke `/`. Tidak ada validasi token di client (kalau salah, request pertama ke Worker gagal 401 dan `client.ts` otomatis redirect balik ke `/login`).
- `apps/web/src/components/RequireAuth.tsx` (baru): route guard, `<Navigate to="/login" />` kalau tidak ada token. Dipasang di `App.tsx` untuk route `/` dan `/tulis`; `/login` sendiri tidak dijaga (supaya tidak infinite redirect).
- Google API key Gemini **TIDAK IKUT** sistem auth ini — tetap di localStorage device-only, sesuai prinsip "API key Google tidak pernah disimpan permanen di server" yang sudah ada sejak awal (keputusan eksplisit user lewat interview, bukan default yang diasumsikan).
- Total test: `pnpm --filter worker test` → 53 hijau (+10: `userAuth.test.ts` baru 4 test, +1 test 401 di `comics.test.ts`, +1 test 401 di `agent.test.ts`, update env di `internalTools.test.ts`). `pnpm --filter web test` → 74 hijau (+16: `client.test.ts`, `Login.test.tsx`, `RequireAuth.test.tsx` baru, +3 test auth token di `storage.test.ts`, update assertion header Authorization di `comics.test.ts`/`agent.test.ts`). Lint+build bersih kedua app.
- **Sudah diverifikasi end-to-end di browser nyata + KV lokal sungguhan** (bukan mock): restart `wrangler dev` dengan binding `AUTH_TOKENS` baru → provisioning 2 token test via `wrangler kv key put --local` (dihapus lagi setelah test, tidak ditinggalkan di KV) → (1) akses tanpa token → 401 lewat curl. (2) Browser tanpa token tersimpan → auto-redirect ke `/login` (dikonfirmasi via `get_page_text`, bukan asumsi). (3) Login dengan token valid → redirect ke Daftar Komik, data 5 comic termuat (bukti `Authorization` header terpasang & diterima Worker). (4) Set token invalid di localStorage lalu reload → token otomatis ter-clear + redirect balik ke `/login` (bukti handling 401 global jalan, bukan crash). (5) Token kedua dengan `user_id` berbeda (`second-user`) → `curl /comics` hasil `[]` (bukti partisi data per-user BENAR-BENAR terpisah di level store, bukan cuma cek header lolos/gagal).
- PR: https://github.com/zeyseil/kecanduan-claude-code-gaming23993/pull/12 (base `main`, 1 commit di atas `main` saat dibuat).

Slice kesebelas — susulan (bug fix, PR #12 lanjutan): user provisioning token production sungguhan (`wrangler kv key put` tanpa `--local`), tapi login selalu 401 walau token benar. Root cause: `wrangler dev` default jalan lokal dengan KV **simulasi** (miniflare), terpisah total dari KV **cloud** tempat token disimpan — Worker lokal tidak pernah bisa melihat token itu.
- Fix: `apps/worker/package.json` script `dev` diganti jadi `wrangler dev --remote` — Worker lokal sekarang konek ke KV cloud asli (satu sumber kebenaran, bukan simulasi lokal).
- Mode `--remote` ternyata butuh 2 syarat akun Cloudflare yang tadinya belum diketahui: (1) **workers.dev subdomain terdaftar** — user daftar sendiri manual di dashboard Cloudflare (link muncul di error message wrangler); (2) **KV namespace preview terpisah dari production** — dibuat via `wrangler kv namespace create AUTH_TOKENS --preview`, `preview_id` hasilnya ditambahkan ke `wrangler.toml` (sekarang binding `AUTH_TOKENS` punya `id` DAN `preview_id`). Token production di-copy juga ke namespace preview supaya bisa dipakai saat dev.
- `apps/worker/README.md` bagian "Setup Auth" diupdate: jelaskan kenapa `--remote` (bukan default lokal), langkah bikin namespace preview, dan provisioning token harus ke KEDUA namespace (production + `--preview`) kalau mau bisa dites di dev.
- **Diverifikasi ulang di browser nyata** dengan token production sungguhan milik user (`user_id` baru bernama "sigma-god", belum ada komik — bukan bug, memang user baru): login sukses, redirect ke Daftar Komik, tampil "0 komik" dengan benar (bukan error).
- Konsekuensi yang dicatat: dev server sekarang sedikit lebih lambat (round-trip ke Cloudflare edge asli, bukan simulasi instan). Kalau nanti tambah token teman baru, harus diisi ke KEDUA namespace (production untuk deploy sungguhan, preview untuk dev) — didokumentasikan di README, bukan otomatis.

Slice kedua belas (branch `feat/add-comic-and-recent-strip`, lanjutan): fix bug `cari_cover_mangadex` (cover AI agent selalu `null`) + rate-limit per-user di level Worker (SPEC.md §3, item resmi yang tersisa dari daftar "belum dibuat"). Dua item lain yang sebelumnya di daftar ini dicoret atas keputusan user lewat interview: migrasi data `demo-user` (dikonfirmasi user hanya data testing, bukan data historis asli — dihilangkan begitu saja, tidak ada migrasi yang dijalankan) dan uji skenario ambiguous end-to-end (user akan memicu ini sendiri secara eksplisit saat pemakaian nyata, bukan dikerjakan Claude).

**Fix bug cover MangaDex** — root cause investigasi read-only dulu (baca `apps/worker/src/lib/mangadex.ts`, `internalTools.ts`, `RateLimiter.ts`, verifikasi live ke API MangaDex sungguhan) sebelum implementasi. Logika query (`includes[]=cover_art`), ekstraksi relationship `cover_art`, dan konstruksi URL cover **sudah benar** — dikonfirmasi cocok response API MangaDex asli. Root cause sebenarnya: `apps/worker/src/lib/mangadex.ts` — outbound `fetch()` ke MangaDex **tidak mengirim header `User-Agent`** sama sekali, dan ketiga cabang kegagalan (`!res.ok`, `!manga`, `!fileName`) `return null` tanpa logging apa pun sehingga tidak bisa dibedakan "genuinely not found" vs "request ditolak MangaDex". MangaDex diketahui menolak/throttle request tanpa User-Agent identifiable, terutama dari IP datacenter (termasuk egress Cloudflare Workers).
- Fix: tambah header `User-Agent: "komik-tracker-worker/1.0 (...)"` pada `fetch(url)`, tambah `console.error` di ketiga titik `return null` (status+statusText MangaDex / title tidak ketemu / manga ketemu tapi tanpa cover_art). Tidak ada perubahan logika parsing/URL — sudah diverifikasi benar sebelumnya.
- **Sudah diverifikasi end-to-end dengan MangaDex API sungguhan** (bukan mock): `wrangler dev` lokal (bukan `--remote`, cukup untuk endpoint `/internal/tools/*` yang tidak butuh KV) + `curl /internal/tools/fetch-cover` dengan judul "One Piece" → `cover_url` **berhasil terisi** URL asli `uploads.mangadex.org` (sebelumnya selalu `null`). Bug terbukti fix — root cause memang header User-Agent yang hilang, bukan logika query/parsing.
- Referensi Python milik user (dua-request: `/manga` lalu `/cover?manga[]=`) TIDAK dipakai sebagai basis implementasi — pendekatan `includes[]=cover_art` satu-request yang sudah ada di kode tetap valid dan lebih efisien, tidak diubah.

**Rate-limit per-user di level Worker:**
- Durable Object baru `apps/worker/src/durable-objects/UserRateLimiter.ts` — token-bucket in-memory per user (`idFromName(userId)`, capacity 20, refill 10/detik). **Beda krusial dari `RateLimiter.ts`** yang sudah ada (itu throttle global ke MangaDex per-IP, busy-loop *menunggu* token tersedia — cocok untuk throttle keluar): `UserRateLimiter` **menolak (429)** request yang melebihi limit, tidak mengantre — karena tujuannya melindungi Worker/Astra dari user, bukan menjaga API eksternal, jadi mengantre hanya menunda penyalahgunaan bukan mencegahnya.
- Middleware baru `apps/worker/src/middleware/rateLimit.ts`: jalan setelah `userAuth` (butuh `c.get("userId")`), balas `429 {"error": "Terlalu banyak request, coba lagi sebentar."}` kalau limiter menolak. Dipasang di `apps/worker/src/routes/comics.ts` (`comics.use("*", userAuth, rateLimit)`) dan `apps/worker/src/routes/agent.ts` (`/process`). TIDAK dipasang di `/internal/tools/*` — itu dilindungi `internalAuth` terpisah (dipanggil Langflow, bukan user langsung), dan `/fetch-cover` di dalamnya sudah punya throttle MangaDex sendiri.
- `apps/worker/src/env.ts` + `wrangler.toml`: binding Durable Object baru `USER_RATE_LIMITER`, class diekspor dari `index.ts`, migrasi baru `tag = "v2"` (tidak mengubah migrasi `RateLimiter` yang sudah ada).
- Nilai limit (capacity 20, refill 10/detik) adalah tebakan awal masuk akal untuk skala aplikasi personal — konstanta di `UserRateLimiter.ts`, gampang disesuaikan kalau ternyata terlalu ketat/longgar saat dipakai nyata.
- Total test: `pnpm --filter worker test` → 60 hijau (+7: `UserRateLimiter.test.ts` baru 3 test, `rateLimit.test.ts` baru 2 test, +1 test 429 di `comics.test.ts`, +1 test 429 di `agent.test.ts`; plus assertion header User-Agent baru di `internalTools.test.ts` untuk fix bug cover). Lint+build bersih.
- **Sudah diverifikasi end-to-end dengan Durable Object sungguhan** (bukan mock, `wrangler dev` lokal port terpisah + token test di KV lokal, dihapus lagi setelah test): (1) 25 request berurutan dengan jeda antar-request → semua 200 (token sempat refill, penggunaan normal tidak kena limit). (2) 30 request **bersamaan** (paralel) dengan token yang sama → sebagian kena 429 setelah capacity 20 habis (bukti limiter benar-benar menolak, bukan cuma unit test). (3) Token user KEDUA dites bersamaan saat user pertama kena overload → tetap 200 (bukti partisi per-user, bukan limit global yang membanjiri semua orang).

**Catatan:** dev server nyata milik user (`wrangler dev --remote` port 8787, dari sesi sebelumnya) tidak disentuh selama verifikasi — semua uji coba dilakukan di instance `wrangler dev` terpisah (mode lokal, port lain) yang dibuat dan dimatikan lagi khusus untuk sesi ini.

**Susulan (bug fix, sesi sama):** setelah slice di atas, user restart dev server dan `wrangler dev --remote` mulai gagal dengan error `wrangler dev --remote is no longer supported for Durable Objects`. Root cause: `--remote` flag global untuk seluruh Worker memang sudah tidak didukung wrangler v4 begitu ada binding Durable Object apa pun (di sini: `RATE_LIMITER` dan `USER_RATE_LIMITER` yang ditambahkan slice ini) — dikonfirmasi lewat dokumentasi resmi Cloudflare (`developers.cloudflare.com/workers/development-testing/`, bagian remote bindings). wrangler versi lama proyek (3.114.17, pinned `^3.90.0`) sendiri TIDAK menghasilkan error ini (diverifikasi langsung — `wrangler dev --remote` dengan DO binding tetap jalan normal di v3), jadi error yang user lihat berasal dari wrangler v4 yang somehow terpakai di sesi terminal user (bukan versi pinned proyek) — kemungkinan npx cache dari eksperimen sebelumnya di sesi ini.
- **Fix (upgrade, bukan revert):** proyek diupgrade ke `wrangler@^4.112.0` + `@cloudflare/workers-types@^5` (peer dependency v4) di `apps/worker/package.json`, supaya fitur *mixed mode* resmi didukung — bukan downgrade balik ke perilaku lama, karena kebutuhan aslinya (dev pakai KV cloud asli) tetap ada.
- `apps/worker/wrangler.toml`: binding `[[kv_namespaces]] AUTH_TOKENS` ditambah `remote = true` — field ini membuat KV konek ke cloud (pakai `preview_id` saat dev) sementara Durable Object (`RATE_LIMITER`/`USER_RATE_LIMITER`) tetap simulasi lokal, dalam satu proses `wrangler dev` yang sama.
- `apps/worker/package.json`: script `dev` diganti dari `wrangler dev --remote` jadi `wrangler dev` biasa (mixed mode tidak pakai flag `--remote` di level Worker sama sekali — remote/local ditentukan per-binding).
- `apps/worker/README.md` bagian "Setup Auth" diupdate menjelaskan mixed mode + satu jebakan baru yang ditemukan: wrangler v4 default `wrangler kv key put/get/delete` menulis/membaca ke KV **lokal** simulasi walau sudah pakai `--preview` — flag `--remote` sekarang wajib eksplisit di setiap perintah provisioning token, kalau lupa token masuk ke KV lokal yang tidak pernah dibaca Worker sungguhan (jebakan ini ditemukan langsung lewat trial-and-error saat verifikasi: `kv key delete` tanpa `--remote` "berhasil" tapi ternyata cuma hapus dari lokal, dibuktikan token masih ada di cloud lewat `kv key get --remote`).
- **Sudah diverifikasi end-to-end dengan KV cloud sungguhan**: provisioning token test ke namespace preview cloud (`--preview --remote`) → `wrangler dev` (mixed mode, TANPA flag apa pun di command line) → curl `/comics` dengan token itu → `200 []` (token dikenali dari cloud asli, DO tetap jalan lokal, dibuktikan lewat log wrangler yang eksplisit menampilkan tabel binding: `AUTH_TOKENS ... Mode: remote` vs `RATE_LIMITER/USER_RATE_LIMITER ... Mode: local`) → token test dihapus lagi dari cloud (`--remote`, dikonfirmasi 404 saat di-`get` ulang).
- `pnpm --filter worker build`/`lint`/`test` tetap bersih (60 hijau) setelah upgrade — tidak ada breaking change dari `@cloudflare/workers-types@^5` yang menyentuh kode existing.

**Susulan kedua (bug fix dokumentasi, sesi sama):** setelah mixed-mode di atas jalan, user coba lagi input Tulis ("baru baca Solo Leveling sampai tamat") — cover MASIH tidak muncul. Dari raw JSON hasil test yang user kirim, ternyata bukan bug cover MangaDex (fix User-Agent sebelumnya sudah terbukti benar) — **komiknya sendiri gagal dibuat**: `create_comic_tool` balas `400 Bad Request`, sehingga `cari_cover_mangadex` bahkan tidak pernah dipanggil sama sekali (urutan tool yang tereksekusi di JSON cuma `find_similar_tool` lalu `create_comic_tool` yang error, TIDAK ada `fetch_cover_tool`).
- **Root cause**: Agent mengirim `comic_status: "finished"` (hasil ekstraksi dari kata "sampai tamat" di teks user), padahal `apps/worker/src/types/comic.ts` (`STATUSES`) hanya menerima literal persis `"ongoing"` atau `"completed"`. Ini bug **system prompt Langflow**, BUKAN bug kode Worker (validasi Worker sudah benar) — pola yang persis sama dengan bug `ai_action` yang ditemukan & difix di slice kesepuluh (LLM memilih kata sinonim bebas, bukan literal yang diizinkan).
- Fix: `apps/worker/langflow/README.md` — tambah aturan eksplisit baru (nomor 4b) di system prompt contoh: field `comic_status` HANYA boleh diisi persis `"ongoing"`/`"completed"`/dikosongkan, dengan contoh kata yang SALAH ("finished", "tamat", "selesai") supaya LLM tidak menebak sinonim. `display_name` field `comic_status` di kode Python `create_comic_tool`/`update_chapter` (dua tool component) juga diperjelas jadi menyebut literal yang diizinkan secara eksplisit, bukan cuma "Status (completed atau kosong)" yang ambigu.
- **Aksi manual user yang masih tertunda**: update system prompt Agent sungguhan di Langflow UI sesuai README yang baru (aturan 4b) — bug ini masih akan terjadi di instance Langflow user sampai prompt-nya diupdate manual, sama seperti bug `ai_action` sebelumnya. Tidak ada perubahan kode Worker di susulan ini (murni dokumentasi/system-prompt), `pnpm --filter worker test` tetap 60 hijau.
- **Catatan untuk verifikasi ulang nanti**: setelah prompt diupdate, tes ulang alur "buat komik baru + status completed/tamat" sampai tuntas (create sukses → fetch-cover ikut terpanggil → cover_url terisi) untuk memastikan baik bug status maupun bug cover (User-Agent) sama-sama benar-benar fix end-to-end, bukan cuma diverifikasi terpisah-pisah.

**Susulan ketiga (gap arsitektur nyata, sesi sama):** setelah fix status di atas, user coba lagi ("saya baru saja membaca komik Naruto tapi hanya chapter 1") — kali ini SEMUA tool sukses termasuk `fetch_cover_tool` (dapat `cover_url` valid dari MangaDex), TAPI comic di Astra collection tetap `cover_url` kosong. Investigasi dari raw JSON: ini BUKAN bug, tapi **celah desain yang belum tercakup `TOOL_CONTRACTS.md`** — `fetch-cover` didesain cuma *mengembalikan* `cover_url` ke Agent, tidak pernah ada mekanisme yang menuliskannya balik ke record comic. `create-comic` selalu set `cover_url: null` dan tidak menerima parameter cover_url; `update-chapter` juga tidak. Jadi walau Agent "tahu" cover_url-nya, tidak ada tool yang bisa dipanggil untuk menyimpannya.
- User diberi 2 opsi lewat interview (reorder fetch-cover sebelum create-comic vs tool baru `set-cover`) dan memilih **tool baru `set-cover`** — comic tetap dibuat dulu (`cover_url: null`), baru `set_cover` dipanggil belakangan untuk menempelkan `cover_url` hasil `fetch-cover`, dipisah dari `create-comic` (bukan reorder+gabung ke satu call).
- `apps/worker/src/routes/internalTools.ts`: endpoint baru `POST /internal/tools/set-cover` — body `{comic_id, cover_url}` (keduanya wajib string non-kosong), 404 kalau comic_id tidak ditemukan, sukses `PATCH` `cover_url` lewat `store.updateComic()` yang sudah ada, balas `{comic_id, updated: true}`.
- `apps/worker/src/routes/agent.ts`: `TOOL_COMPONENT_IDS` bertambah satu entry **placeholder** `"CustomComponent-REPLACE-ME-set-cover"` — id sungguhan belum ada karena node-nya belum dibuat user di Langflow (beda dari 5 tool lain yang id-nya sudah dikonfirmasi dari flow nyata). Dikomentari eksplisit di kode: kalau placeholder ini tidak diganti id asli setelah user bikin node baru, tweaks `internal_secret`/`app_user_id` diam-diam tidak sampai ke node itu (gagal tanpa error jelas).
- `TOOL_CONTRACTS.md`: section baru §4b (`set-cover`) + catatan eksplisit di §4 (`fetch-cover`) bahwa tool itu HANYA mencari, tidak menyimpan — supaya gap ini tidak terulang kalau kontrak dibaca ulang nanti. Tabel ringkasan tool ditambah baris `set_cover`.
- `apps/worker/langflow/README.md`: kode Python `SetCoverTool` baru (§5, sebelum `log_proses` yang jadi §6), system prompt diperbarui (aturan panggil `set_cover` setelah `cari_cover_mangadex` sukses dengan cover_url non-null, JANGAN panggil kalau null), section baru "Menambahkan node `set_cover` ke flow existing" — langkah manual lengkap untuk user (bikin Custom Component baru, sambungkan ke Agent, isi id asli ke `agent.ts`, update system prompt).
- Total test: `pnpm --filter worker test` → 63 hijau (+3: `set-cover` sukses/404/400 di `internalTools.test.ts`; +1 assertion tweaks di `agent.test.ts` untuk id placeholder). Lint+build bersih.
- **Aksi manual user yang masih tertunda (belum bisa diverifikasi otomatis)**: bikin node `set_cover` baru secara manual di Langflow UI (kode sudah disiapkan di README), salin id asli ke `agent.ts` menggantikan placeholder, update system prompt Agent, baru test ulang alur buat komik baru sampai tuntas untuk konfirmasi `cover_url` akhirnya benar-benar tersimpan di Astra. Ini melengkapi rangkaian 3 bug/gap yang ditemukan berturut-turut dari satu isu "cover tidak muncul": (1) User-Agent hilang di fetch MangaDex — fix, terverifikasi lewat curl; (2) status literal salah (`ai_action`-like bug) — fix di dokumentasi, perlu update manual prompt user; (3) gap arsitektur set-cover — fix kode+dokumentasi, perlu setup manual node baru + prompt user.

Slice ketiga belas (branch `feat/add-comic-and-recent-strip`, lanjutan): siapkan hosting Langflow di **cloud** (menggantikan Langflow lokal yang sering disconnect — DataStax Langflow deprecated & tidak pernah dipakai) + keep-alive cron di Worker. Rencana AWAL sesi ini adalah Hugging Face Spaces, **dicoret dan diganti Koyeb di slice keempat belas** (lihat alasan di sana) — bagian di bawah ini menjelaskan kode yang dibuat di slice ini yang TETAP relevan (platform-agnostic) vs yang sudah diganti.
- **Keep-alive (tetap relevan, platform-agnostic):** `apps/worker/wrangler.toml` tambah `[triggers] crons = ["*/30 * * * *"]`. `apps/worker/src/index.ts`: default export berubah dari Hono `app` polos jadi `{ fetch: app.fetch, scheduled }`; handler `scheduled` nge-ping `env.LANGFLOW_HEALTH_URL` (GET), **no-op kalau env kosong** (aman untuk dev lokal), **tidak pernah throw** (ping gagal ≠ error Worker). `app` sekarang jadi named export (`export const app`) — 3 test yang import default (`agent.test.ts`, `comics.test.ts`, `internalTools.test.ts`) diubah ke `import { app }`.
- `apps/worker/src/env.ts`: field baru `LANGFLOW_HEALTH_URL?: string` (opsional). `.dev.vars.example` didokumentasikan.
- **Secret tool component dari env (tetap relevan):** `apps/worker/langflow/README.md` — kode Python 6 tool component diubah: `internal_secret`/`worker_base_url` sekarang default dibaca `os.getenv("INTERNAL_TOOLS_SECRET")`/`os.getenv("WORKER_BASE_URL")` (platform manapun, diisi lewat env var terenkripsi platform-nya), field input jadi override opsional (kosong = pakai env). `app_user_id` & `api_key` Google TETAP per-request lewat tweaks (tidak jadi env). Bagian "Tweaks yang dikirim" diperbarui.
- `apps/worker/README.md` bagian Deploy: tambah `wrangler secret put` untuk `PROCESS_LOG_COLLECTION`/`INTERNAL_TOOLS_SECRET`/`LANGFLOW_API_URL`/`LANGFLOW_API_KEY`/`LANGFLOW_HEALTH_URL` + penjelasan cron keep-alive.
- **Scaffold HF (`hf-space/Dockerfile`, `hf-space/README.md`, `HF_DEPLOY.md`) sudah DIHAPUS di slice keempat belas**, digantikan scaffold Koyeb — lihat slice keempat belas untuk detail dan alasan pivot.
- `comic-tracker-flow.json` TIDAK diedit (scaffold yang sudah gagal diimpor + embed Python sebagai string JSON, hand-edit berisiko tanpa payoff) — hanya ditambah disclaimer di README bahwa JSON itu masih pola lama (literal secret), kosongkan field-nya setelah import atau bangun manual dari kode env-based.
- Total test: `pnpm --filter worker test` → 66 hijau (+3: `scheduled.test.ts` baru — ping saat env di-set, skip saat kosong, tidak throw saat gagal). Lint+build bersih.

Slice keempat belas (branch `feat/add-comic-and-recent-strip`, lanjutan): user mulai eksekusi Tahap 1 (Neon) dari rencana hosting Langflow, MENEMUKAN Docker/Gradio Space HF kini butuh langganan HF PRO berbayar di akunnya (bertentangan dengan asumsi "gratis" saat rencana disusun) — HF dicoret, **diganti Koyeb** (dipilih user, dikonfirmasi lewat WebFetch ke dokumentasi resmi Koyeb sebelum dipakai sebagai dasar keputusan, bukan tebakan).
- **Tahap 1 (Neon) SELESAI & diverifikasi nyata:** Langflow Desktop user disambungkan ke Neon lewat `LANGFLOW_DATABASE_URL`. Dua bug troubleshooting nyata ditemukan & difix saat setup (dicatat di `apps/worker/langflow/ORACLE_DEPLOY.md` untuk referensi setup ulang di environment lain): (1) Langflow Desktop membaca `.env` di `%APPDATA%\com.LangflowDesktop\data\.env` (bukan murni OS env var), tapi ternyata Langflow Desktop otomatis menyinkronkan OS env var `LANGFLOW_DATABASE_URL` ke file itu sendiri saat start — tidak perlu diisi manual; (2) error "PostgreSQL Driver Missing" butuh **`psycopg2-binary`**, BUKAN `psycopg[binary]` seperti disarankan pesan error Langflow sendiri — root cause: SQLAlchemy men-default-kan dialect `psycopg2` untuk connection string berskema `postgresql://` tanpa suffix. Diverifikasi lewat script Python ad-hoc yang connect langsung ke Neon dari venv Langflow Desktop: 34 tabel (`flow`, `user`, `variable`, `folder`, dst) berhasil dibuat Alembic migration.
- **Riset platform pengganti HF:** dicek langsung ke dokumentasi resmi Koyeb (`koyeb.com/docs/reference/instances`) via WebFetch, bukan hasil pencarian yang saling bertentangan — dikonfirmasi: free tier scale-to-zero setelah **1 jam idle** (lebih agresif dari asumsi HF 48 jam), 512MB RAM/0.1 vCPU (berisiko OOM untuk Langflow yang cukup berat — user memilih coba dulu, evaluasi kalau gagal), **tidak ada Volume/disk persisten** (tidak masalah karena sudah pakai Neon), mendukung deploy Docker langsung dari **monorepo** (fitur "Work directory") — beda dari HF Spaces yang wajib repo terpisah.
- **Scaffold Koyeb dibuat sesi ini, DIHAPUS lagi di slice kelima belas** (menggantikan `hf-space/`+`HF_DEPLOY.md` yang dihapus di slice ini) — lihat slice kelima belas untuk alasan (Koyeb diakuisisi Mistral, sign-up gratis ditutup) dan penggantinya (Oracle Cloud VM).
- Semua komentar kode yang menyebut Hugging Face diupdate ke Koyeb sesi ini, lalu diupdate LAGI ke Oracle Cloud di slice kelima belas — lihat slice kelima belas untuk daftar file final.
- `apps/worker/langflow/hf-space/` dan `apps/worker/langflow/HF_DEPLOY.md` **DIHAPUS** total (bukan dibiarkan stale) — CLAUDE.md prinsip "dokumen harus akurat", scaffold HF sudah tidak berlaku.
- Tidak ada perubahan logika Worker (murni dokumentasi/scaffold/komentar) — `pnpm --filter worker test` tetap 66 hijau, lint bersih.

Slice kelima belas (branch `feat/add-comic-and-recent-strip`, lanjutan): user mencoba eksekusi Tahap 2 Koyeb dari slice keempat belas, MENEMUKAN dashboard Koyeb mentok di halaman kosong "Koyeb is joining Mistral" untuk akun baru — Koyeb dicoret, **diganti Oracle Cloud Always Free (VM)**, atas usul user setelah riwayat pribadi dari sesi lain (ChatGPT) diverifikasi ulang ke `docs.oracle.com` resmi sebelum dipakai sebagai dasar keputusan.
- **Riset dikonfirmasi ke sumber resmi (bukan cuma diteruskan dari user):** WebSearch mengonfirmasi Koyeb diakuisisi Mistral AI (Februari 2026), sign-up baru dibatasi ke plan Pro ke atas (Starter/free ditutup untuk akun baru) — cocok dengan gejala yang dialami user. `render.com/docs/free` dicek juga sebagai alternatif PaaS: sleep 15 menit idle (lebih agresif dari cron 30 menit kita, jadi butuh penyesuaian kalau dipakai) — TIDAK dipilih karena Oracle lebih unggul. `docs.oracle.com` (2 halaman resmi) mengonfirmasi klaim user: Always Free ≠ trial 30 hari/$300 kredit (program terpisah), VM shape `VM.Standard.A1.Flex` total 2 OCPU + 12GB RAM selamanya gratis, boot volume ~47GB persisten. Riset tambahan (WebSearch) mengonfirmasi tool komunitas untuk mengakali "Out of Capacity" A1 yang terkenal sering terjadi: `oci-arm-host-capacity` dan `oracle-cloud-repeater` (retry lintas Availability Domain/region).
- **Perbedaan arsitektural penting vs HF/Koyeb:** Oracle BUKAN PaaS — tidak ada build otomatis dari Dockerfile/Git. User yang menjalankan `docker compose up -d` langsung di VM. Karena VM sungguhan (bukan container serverless), **tidak pernah sleep** — keep-alive cron yang dibangun slice ketiga belas jadi tidak lagi wajib mencegah sleep, tapi dipertahankan sebagai monitoring uptime ringan (tidak dihapus, komentar kode diupdate menjelaskan perubahan makna ini).
- **Scaffold Oracle baru** (menggantikan `koyeb/`+`KOYEB_DEPLOY.md` yang dihapus): `apps/worker/langflow/oracle-vm/docker-compose.yml` (2 service: `langflow` tidak di-expose langsung ke publik + `caddy` reverse proxy HTTPS otomatis via Let's Encrypt), `oracle-vm/Caddyfile`, `oracle-vm/.env.example`, `oracle-vm/README.md` + `apps/worker/langflow/ORACLE_DEPLOY.md` (panduan 5 tahap: Neon [selesai] → provisioning VM Frankfurt dengan mitigasi capacity → hardening firewall 2 lapis + Docker → deploy compose → wiring Worker; termasuk riwayat lengkap 3 pivot platform di bagian atas file).
- Region VM: **Frankfurt** (dipilih user — 3 Availability Domain, capacity A1 dilaporkan komunitas lebih baik dari region Asia, latensi wajar dipanggil Worker Cloudflare global). Dicatat eksplisit di `ORACLE_DEPLOY.md`: Home Region tidak bisa diganti mudah setelah sign-up.
- Semua komentar kode yang menyebut Koyeb diupdate ke Oracle/VM (makna berubah dari "keep-alive wajib" ke "monitoring opsional"): `apps/worker/wrangler.toml`, `apps/worker/src/env.ts`, `apps/worker/README.md`, `apps/worker/.dev.vars.example`, `apps/worker/langflow/README.md` (bagian "Tweaks yang dikirim" + 6 komentar `worker_base_url`/`internal_secret` — sekarang menyebut file `.env` docker-compose, bukan "Environment variables" platform), `apps/worker/src/scheduled.test.ts` (URL contoh di test).
- `apps/worker/langflow/koyeb/` dan `apps/worker/langflow/KOYEB_DEPLOY.md` **DIHAPUS** total (sama seperti HF sebelumnya — dokumen harus akurat, bukan dibiarkan stale).
- Tidak ada perubahan logika Worker (murni dokumentasi/scaffold/komentar) — `pnpm --filter worker test` tetap 66 hijau, lint bersih.
- **Rencana Oracle ini TIDAK JADI dieksekusi** — verifikasi kartu Oracle user selalu gagal (Oracle menolak kartu prepaid/virtual). Seluruh arah hosting Langflow dibatalkan di slice keenam belas.

Slice keenam belas (branch `feat/add-comic-and-recent-strip`, lanjutan): **Langflow DIHAPUS TOTAL** — orkestrasi AI dipindahkan ke dalam Worker memakai Gemini function calling langsung. Ini keputusan arsitektur besar, diambil user setelah review mendalam yang saya ajukan.
- **Alasan:** empat platform hosting gagal berturut-turut (DataStax deprecated; HF Spaces Docker butuh PRO berbayar; Koyeb tutup sign-up gratis setelah diakuisisi Mistral Feb 2026; Oracle Cloud verifikasi kartu gagal berulang). Render dipertimbangkan tapi RAM 512MB berisiko OOM + sleep 15 menit. Di luar hosting, Langflow sendiri sudah menyebabkan **7 bug/gap** sepanjang proyek. Peran Langflow ternyata sederhana: panggil Gemini dengan 6 tool yang SEMUANYA sudah diimplementasi di Worker dan tidak bergantung pada Langflow sama sekali.
- **Keuntungan struktural (bukan sekadar kosmetik):** nilai berbatas (`type_tag`, `status`, `ai_action`) sekarang dideklarasikan sebagai `enum` di schema fungsi Gemini, ditegakkan oleh API. Dua bug literal yang dulu terjadi (`ai_action: "update_chapter"`, `comic_status: "finished"`) jadi **tidak mungkin terjadi lagi**, bukan cuma "sudah diingatkan di prompt".
- **Arsip:** branch `archive/langflow-orchestration` (sudah di-push ke origin) menyimpan seluruh state Langflow terakhir — README dengan kode Python 6 tool component, system prompt, scaffold Oracle/oracle-vm, `LANGFLOW_FLOW.md`. Tidak akan pernah di-merge, murni titik pulih/referensi.
- **Modul baru `apps/worker/src/agent/`:** `systemPrompt.ts` (port dari prompt Langflow yang sudah terbukti jalan, minus 2 aturan yang digantikan enum), `tools.ts` (registry 6 tool: deklarasi schema Gemini + executor in-process; logika dipindah apa adanya dari `internalTools.ts`, reuse `getComicStore`/`getProcessLogStore`/`acquireMangaDexSlot`/`fetchMangaDexCover`; konstanta `TYPE_TAGS`/`STATUSES`/`AI_ACTIONS` dipakai langsung sebagai nilai enum jadi satu sumber kebenaran), `geminiClient.ts` (pembungkus REST `generateContent` — dipilih user karena stateless & mudah di-test walau Google menandainya legacy; API key dikirim lewat header `x-goog-api-key`, BUKAN query param, supaya tidak bocor ke log), `runAgent.ts` (loop tool-calling + penjaga `MAX_TURNS = 10`).
- Model default `gemini-3.5-flash` (Flash dipilih user — cukup untuk tugas terstruktur, hemat kuota API key user), bisa ditimpa lewat `env.GEMINI_MODEL` tanpa ubah kode. **Nama model ini adalah risiko yang disadari** — diambil dari contoh di dokumentasi resmi Google saat sesi ini; kalau Google mengganti/menghentikannya, gejalanya 502 dengan detail dari Google, fix-nya set `GEMINI_MODEL`.
- **Error handling sengaja dibedakan:** kegagalan tool yang wajar (comic tidak ditemukan, arg tidak valid) dikembalikan sebagai `{ error }` ke model lewat `functionResponse` supaya agent bisa menjelaskan ke user — bukan mematikan seluruh run. Hanya kegagalan Gemini (jaringan/HTTP) dan `MAX_TURNS` terlampaui yang jadi `502`.
- **Respons `/agent/process` berubah bentuk** dari JSON mentah Langflow jadi `{ message, tool_calls }` yang kita kendalikan sendiri. Konsekuensi frontend: `apps/web/src/lib/parseAgentResult.ts` + testnya **DIHAPUS** (tidak perlu men-drill struktur Langflow lagi), `lib/api/agent.ts` sekarang punya tipe `AgentResult` sungguhan (bukan `unknown`), `routes/Tulis.tsx` baca `result.message` langsung dan `<details>` menampilkan daftar tool yang dipanggil.
- **Dihapus:** `routes/internalTools.ts`+test, `middleware/internalAuth.ts`+test, seluruh folder `apps/worker/langflow/`, handler `scheduled` + `[triggers] crons` di `wrangler.toml` (tidak ada lagi yang perlu di-ping), `scheduled.test.ts`, `LANGFLOW_FLOW.md`, env `LANGFLOW_API_URL`/`LANGFLOW_API_KEY`/`LANGFLOW_HEALTH_URL`/`INTERNAL_TOOLS_SECRET`. **Dipertahankan:** `RATE_LIMITER` (throttle MangaDex per-IP masih dipakai `cari_cover_mangadex`) dan `USER_RATE_LIMITER` (rate-limit per-user).
- `TOOL_CONTRACTS.md` direvisi dari kontrak HTTP jadi kontrak fungsi internal (definisi 6 tool + aturan skor tetap berlaku, bagian auth/header diganti penjelasan `ToolContext`). `SPEC.md` §4 "Peran Langflow" → "Orkestrasi AI (di dalam Worker)". `README.md` root disesuaikan.
- Total test: `pnpm --filter worker test` → **54 hijau** (`agent.test.ts` ditulis ulang total: 15 test, mock `fetch` di-route berdasarkan URL supaya Gemini & MangaDex bisa dibedakan, plus mock `@datastax/astra-db-ts` dengan 2 collection terpisah sehingga tool benar-benar dieksekusi terhadap store palsu). `pnpm --filter web test` → **72 hijau**. Lint + build bersih kedua app.
- **Test yang paling penting:** alur create end-to-end memverifikasi `cover_url` BENAR-BENAR tersimpan di store setelah `set_cover` — memakai turn "lazy" yang membaca `comic_id` hasil `buat_entry_baru` saat runtime. Versi pertama test ini sempat memakai `comic_id: "PLACEHOLDER"` yang membuat `set_cover` diam-diam gagal tanpa test ikut merah; ini diperbaiki karena justru itu perilaku yang rangkaian bug cover-nya paling rawan.
- **Diverifikasi otomatis:** `wrangler dev` boot bersih tanpa binding Langflow; `curl /` → 200; `curl /internal/tools/find-similar` → **404** (bukti endpoint benar-benar hilang); `curl /agent/process` tanpa token → **401** (bukti auth masih menjaga).
- Catatan: `.dev.vars` lokal user masih memuat `LANGFLOW_*`/`INTERNAL_TOOLS_SECRET` yang kini tidak terpakai — tidak saya sentuh (file kredensial milik user), aman dihapus sendiri kapan saja.

**Verifikasi end-to-end dengan API key Gemini asli (sesi yang sama, di browser + Astra sungguhan) — LULUS, dan menemukan 4 hal penting:**
- **Alur update LULUS:** "baru baca naruto ch2" → 3 tool (`cari_komik_mirip` skor 1.0 vs 0.15/0.12 → `update_chapter` → `log_proses`), Naruto Ch1→Ch2, `comic_id` SAMA, tidak ada duplikat.
- **Alur create + rantai cover LULUS (ini yang menutup rangkaian 3 bug cover):** "baru baca One Piece ch3" → 5 tool berurutan `cari_komik_mirip` (tidak ada kandidat ≥0.5) → `buat_entry_baru` → `cari_cover_mangadex` (dapat URL MangaDex asli) → `set_cover` (`updated: true`) → `log_proses` (`ai_action: "created"`). Cover **benar-benar termuat** di UI (dicek `naturalWidth` 400×564, bukan sekadar URL tersimpan). Data test dibersihkan setelahnya (One Piece dihapus, Naruto dikembalikan ke Ch 1).
- **TEMUAN 1 — kuota free tier jauh lebih ketat dari dugaan:** Gemini free tier membatasi **20 request/hari PER MODEL**, dan **satu run agent memakai 4–6 request** (tiap putaran tool-calling = 1 request). Jadi satu model ≈ hanya **3–5 kali pakai per hari**. Ditemukan dari error 429 `RESOURCE_EXHAUSTED` sungguhan. Ini batasan produk nyata yang perlu disadari, bukan bug.
- **TEMUAN 2 — `gemini-flash-latest` menunjuk ke `gemini-3.5-flash`** (dibuktikan dari pesan 429 yang menyebut model itu walau kita set alias). Jadi ganti alias TIDAK memindahkan ember kuota. Default akhirnya **`gemini-flash-lite-latest`** — kuota terpisah, dan terbukti **jauh lebih cepat** (~15 detik vs ~40 detik per run) tanpa penurunan kualitas untuk tugas terstruktur ini. `gemini-2.5-flash` sudah tidak tersedia untuk user baru (404).
- **TEMUAN 3 — efek samping tool TIDAK di-rollback saat loop gagal di tengah.** Terjadi 2× selama testing: Gemini 503/429 di turn tengah → `buat_entry_baru` sudah terlanjur membuat comic, tapi user cuma melihat error 502 dan `cari_cover_mangadex`/`set_cover`/`log_proses` tidak pernah jalan. Akibatnya: comic yatim tanpa cover dan tanpa audit trail. **Ini keterbatasan desain yang diketahui, BELUM diperbaiki** — perbaikan yang mungkin: kompensasi (hapus comic kalau run gagal setelahnya) atau tandai comic sebagai "belum lengkap". Perlu keputusan user.
- **TEMUAN 4 — pesan error Gemini tidak terbaca user.** "Gemini menolak permintaan" tidak memberi tahu apa pun. Diperbaiki: `explainGeminiError()` di `routes/agent.ts` memetakan 429 → "Kuota harian habis…", 503 → "Model sedang penuh, coba lagi sebentar", 400/403 → "API key ditolak", 404 → "Model tidak ditemukan, set GEMINI_MODEL".
- **Retry ditambahkan** di `geminiClient.ts`: 3 percobaan, backoff 500ms→1s (total ~1,5 detik) untuk status transient (500/502/503/504). **429 sengaja TIDAK di-retry** — Google sendiri meminta tunggu ~57 detik, jadi retry dalam-request hanya menahan user sebelum tetap gagal. Backoff sengaja pendek karena 503 yang teramati bertahan bermenit-menit, bukan sedetik-dua.
- Total test setelah verifikasi: `pnpm --filter worker test` → **57 hijau** (+3: retry 503 berhasil, menyerah setelah MAX_ATTEMPTS, 429 tidak di-retry; plus assertion pesan error human-readable).

## Verifikasi Manual — Orkestrasi Gemini di Worker (Slice keenam belas)
1. `pnpm --filter worker test` → 54 hijau, `pnpm --filter web test` → 72 hijau.
2. `pnpm --filter worker dev` + `pnpm --filter web dev`. Login dengan token Anda, buka halaman Tulis, pastikan API key Gemini terisi.
3. **Alur update:** input "baru baca <judul komik yang sudah ada> ch<N>" → harus muncul pesan human-readable. Cek Astra: `comic_id` SAMA (bukan entry baru), `latest_chapter` berubah, `process_log` bertambah dengan `ai_action: "updated"`.
4. **Alur create + cover (paling kritis):** input komik yang BELUM ada, judul yang pasti ada di MangaDex (mis. "baru baca One Piece ch1") → cek Astra: comic dibuat DAN **`cover_url` terisi**. Buka `<details>` di UI untuk melihat urutan tool: harus ada `cari_cover_mangadex` LALU `set_cover`.
5. **Alur ambigu:** input judul yang mirip 2 komik existing dengan skor berdekatan → tidak ada comic dibuat/diupdate, `process_log` tercatat `ai_action: "ambiguous"`, UI menampilkan pilihan.
6. **Error handling:** kosongkan API key → pesan error tanpa request network. Isi API key ngawur → pesan error jelas (502 dengan detail dari Google), bukan crash.
7. **Kalau muncul 502 dengan detail "model not found"** → nama model default sudah berubah di sisi Google; set `GEMINI_MODEL` di `.dev.vars` ke model Flash yang berlaku saat itu.
8. Bandingkan hasil langkah 3–5 dengan perilaku flow Langflow lama (arsip branch `archive/langflow-orchestration`) — kalau ada perbedaan, flow lama yang jadi acuan karena sudah terbukti benar; sesuaikan prompt/schema di `src/agent/`.

## Verifikasi Manual — Auth Token + KV (Slice kesebelas, wrangler dev --remote)
1. `cd apps/worker`. Buat KV namespace production sekali (kalau belum ada): `wrangler kv namespace create AUTH_TOKENS`, tempel `id` yang muncul ke `wrangler.toml` (field `id` di blok `[[kv_namespaces]]`).
2. Buat KV namespace **preview** (wajib untuk `wrangler dev --remote`, terpisah dari langkah 1): `wrangler kv namespace create AUTH_TOKENS --preview`, tempel `preview_id` ke blok yang sama di `wrangler.toml`.
3. Pastikan akun Cloudflare-mu punya **workers.dev subdomain** terdaftar — kalau belum, `wrangler dev --remote` akan gagal start dengan pesan error berisi link untuk mendaftar (dashboard Cloudflare, langkah manual sekali-jalan per akun).
4. Generate token untuk diri sendiri, simpan ke KEDUA namespace:
   ```
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak-mu>" "<user-id-bebas>"
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak-mu>" "<user-id-bebas>" --preview
   ```
5. `pnpm --filter worker test` → harus tetap 53 hijau. `pnpm --filter worker dev` (sekarang `wrangler dev --remote`, startup lebih lambat dari mode lokal — tunggu sampai log menunjukkan "Ready on http://127.0.0.1:8787" dan "Starting remote preview...") + `pnpm --filter web dev`.
6. Buka web app di browser tanpa token tersimpan di localStorage → harus otomatis redirect ke `/login`.
7. Masukkan token dari langkah 4 di halaman Login → submit → harus redirect ke Daftar Komik dan data termuat (kalau Anda sudah punya data lama dengan `user_id` lain, buat token dengan `user_id` yang sama supaya bisa mengaksesnya).
8. Test token salah: masukkan token asal di localStorage (`komik-tracker:auth-token`) lalu reload — harus otomatis ter-clear dan redirect ke `/login`, bukan crash/layar putih.
9. Test partisi data: buat token kedua dengan `user_id` BEDA (simpan ke kedua namespace juga), `curl localhost:8787/comics -H "Authorization: Bearer <token-kedua>"` → harus balas `[]` atau daftar berbeda dari user pertama (bukti data benar-benar terpisah).
10. Bagikan token ke teman yang mau ikut pakai (chat/dsb) — mereka isi sendiri di halaman Login. Untuk mencabut akses: `wrangler kv key delete --binding=AUTH_TOKENS "<token>"` (tambah `--preview` juga kalau perlu cabut dari namespace dev).

## Verifikasi Manual — Backend Agent Nyata (Slice kedelapan)
1. `cd apps/worker`, tambahkan ke `.dev.vars`: `PROCESS_LOG_COLLECTION`, `INTERNAL_TOOLS_SECRET` (string acak, mis. `openssl rand -hex 32`), `LANGFLOW_API_URL`, `LANGFLOW_API_KEY` (dua terakhir diisi setelah langkah 4).
2. `pnpm --filter worker run create-collection` — sekarang bikin 2 collection (`comics` + `process_log`), aman dijalankan berkali-kali.
3. `pnpm --filter worker test` → harus 45 hijau. `pnpm --filter worker dev`, lalu test tiap tool langsung (tanpa Langflow dulu):
   - `curl -X POST localhost:8787/internal/tools/create-comic -H "Content-Type: application/json" -H "X-Internal-Secret: <secret>" -H "X-User-Id: demo-user" -d '{"title":"Test","type_tag":"manga","is_adult":false,"chapter":1,"status":null}'`
   - `curl -X POST localhost:8787/internal/tools/find-similar -H "Content-Type: application/json" -H "X-Internal-Secret: <secret>" -H "X-User-Id: demo-user" -d '{"candidate_title":"test"}'` → comic barusan harus muncul dengan skor tinggi.
   - `curl -X POST localhost:8787/internal/tools/log-process -H "Content-Type: application/json" -H "X-Internal-Secret: <secret>" -H "X-User-Id: demo-user" -d '{"input_text":"tes","ai_action":"created","target_comic_id":null,"confirmed":true}'` → cek Astra Data Explorer, collection `process_log` harus terisi.
   - Tanpa header `X-Internal-Secret` yang benar → harus 401 di semua endpoint `/internal/tools/*`.
4. Baca `apps/worker/langflow/README.md`, import `comic-tracker-flow.json` ke Langflow Anda (DataStax hosted atau self-host). **Kemungkinan besar perlu penyesuaian manual** (JSON ini scaffold best-effort, bukan jaminan siap-pakai) — README berisi kode Python 5 tool + system prompt lengkap sebagai fallback kalau import gagal. Isi field `worker_base_url` di tiap Tool node ke URL Worker Anda.
5. Salin flow id dari URL Langflow, set `LANGFLOW_API_URL=https://<langflow-host>/api/v1/run/<flow-id>` dan `LANGFLOW_API_KEY` di `.dev.vars`.
6. Test dulu langsung di Playground Langflow (input teks contoh) sebelum lewat Worker.
7. `curl -X POST localhost:8787/agent/process -H "Content-Type: application/json" -d '{"teks_input":"baru baca monster ch33","google_api_key":"<google api key asli Anda>"}'` — cek response, dan cek Astra (`comics` terupdate, `process_log` tercatat).
8. Test skenario ambigu: input judul yang mirip 2 komik existing dengan skor berdekatan → response harus minta konfirmasi, TIDAK auto-create/update.

## Verifikasi Manual — Tulis + Upload Cover (Slice kesembilan)
1. Kalau collection `comics` Anda dibuat SEBELUM slice ini (field `cover_url` masih ter-index, limit 8000 byte): `cd apps/worker`, `pnpm --filter worker run migrate-cover-index` dulu (dry-run, cuma backup — cek jumlah dokumen & lokasi file backup yang ditampilkan), lalu `pnpm --filter worker run migrate-cover-index -- --confirm` untuk benar-benar drop+recreate+restore. Untuk setup baru dari nol, `create-collection` sudah otomatis benar (skip langkah ini).
2. `pnpm --filter worker dev` + `pnpm --filter web dev`, buka halaman Daftar Komik → Tambah Komik → upload foto beresolusi tinggi (mis. screenshot HP) → submit harus sukses (bukan error generik).
3. Buka halaman Tulis, isi API key Gemini asli (dari aistudio.google.com/apikey) di field yang muncul — cek localStorage browser (`komik-tracker:google-api-key`) menyimpan nilainya.
4. Isi teks tentang komik yang **sudah ada** di Astra (mis. "baru baca <judul existing> ch<N>") → klik "Proses dengan AI" → tombol berubah "Memproses…" → tunggu (real Langflow call, bisa 5-50 detik) → hasil JSON mentah tampil di bawah editor. Cek Astra: comic itu harus lewat `update_chapter` (chapter berubah, `comic_id` SAMA — bukan entry baru).
5. Test skenario ambigu: isi teks dengan judul yang sengaja mirip 2+ komik existing dengan skor berdekatan → hasil harus berisi daftar pilihan/minta konfirmasi user, dan cek Astra: TIDAK ada comic baru dibuat atau ter-update otomatis.
6. Test error handling: kosongkan API key lalu submit → harus muncul pesan "Isi API key Gemini dulu sebelum memproses." tanpa request ke network sama sekali (cek Network tab browser, tidak ada request `/agent/process`).

## Verifikasi Manual — Astra DB (Slice keenam)
1. `cd apps/worker && cp .dev.vars.example .dev.vars`, isi `ASTRA_DB_API_ENDPOINT`/`ASTRA_DB_APPLICATION_TOKEN`/`ASTRA_DB_COLLECTION` dengan kredensial Astra DB asli (dari Astra Console).
2. `pnpm --filter worker run create-collection` — buat collection sekali (aman dijalankan berkali-kali, no-op kalau sudah ada).
3. `pnpm --filter worker test` → harus tetap 13 hijau (hanya hit mock, bukan Astra DB sungguhan).
4. `pnpm --filter worker dev`, lalu:
   - `curl -X POST localhost:8787/comics -H "Content-Type: application/json" -d '{"title":"Test","type_tag":"manga","is_adult":false,"latest_chapter":1,"status":"ongoing"}'`
   - `curl localhost:8787/comics` → comic barusan harus muncul
   - `curl -X PATCH localhost:8787/comics/<comic_id> -H "Content-Type: application/json" -d '{"latest_chapter":2}'`
5. **Stop lalu start ulang `wrangler dev`**, `curl localhost:8787/comics` lagi — comic yang dibuat di langkah 4 harus MASIH ADA (bukti persistensi nyata, beda dari behavior in-memory sebelumnya yang hilang tiap restart).
6. Opsional: cek Astra Data Explorer (web UI) untuk lihat dokumen dengan `user_id: "demo-user"` tersimpan di collection.

## Stack
- Frontend: React, dibungkus Tauri (desktop) & Capacitor (Android) — satu codebase
- Backend perantara: Cloudflare Worker
- Orkestrasi AI: **di dalam Cloudflare Worker** (`apps/worker/src/agent/`), memanggil Gemini function calling langsung — TIDAK ada layanan orkestrasi eksternal. Langflow dihapus setelah empat platform hosting gagal berturut-turut (DataStax deprecated, HF Spaces butuh PRO, Koyeb tutup sign-up gratis, Oracle Cloud verifikasi kartu gagal) dan Langflow sendiri sudah menyebabkan 7 bug/gap; arsip di branch `archive/langflow-orchestration`
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
- Baca PRD.md, SPEC.md, TOOL_CONTRACTS.md sebelum mulai fitur baru
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
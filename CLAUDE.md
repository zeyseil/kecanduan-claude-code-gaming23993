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
- **BELUM diverifikasi end-to-end dengan Langflow sungguhan** (user belum punya instance Langflow) — hanya diverifikasi lewat unit test dengan mock. Lihat "Verifikasi Manual — Backend Agent Nyata" di bawah untuk langkah setelah user setup Langflow.
- Kredensial (`INTERNAL_TOOLS_SECRET`, `LANGFLOW_API_URL`, `LANGFLOW_API_KEY`, `PROCESS_LOG_COLLECTION`) diisi user sendiri lewat `.dev.vars` — tidak pernah diisi Claude.

BELUM dibuat: wrapper Tauri & Capacitor, halaman Tulis disambungkan ke `/agent/process`, auth token+KV, persistensi localStorage untuk web kalau backend down, bulk select/bulk delete (di luar scope, sengaja tidak dikerjakan), rate-limit per-user di level Worker (SPEC.md §3 — beda dari throttle MangaDex per-IP yang sudah dibuat), verifikasi end-to-end dengan Langflow instance sungguhan.

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
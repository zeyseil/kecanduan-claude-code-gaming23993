# apps/worker

Cloudflare Worker (Hono) — backend perantara antara `apps/web` dan Astra DB.

## Setup Astra DB

1. Salin `.dev.vars.example` ke `.dev.vars` (gitignored) dan isi dengan kredensial Astra DB milikmu sendiri (Astra Console -> database -> tab "Connect" untuk API endpoint, "Generate Token" untuk application token).
2. Buat collection sekali (kalau belum ada di database Astra kamu):
   ```
   pnpm --filter worker run create-collection
   ```
3. Jalankan dev server: `pnpm --filter worker dev` (wrangler otomatis membaca `.dev.vars`).

## Setup Auth (token per user)

`/comics` dan `/agent/process` sekarang butuh header `Authorization: Bearer <token>`. Token disimpan sebagai key di Cloudflare KV, value-nya `user_id` bebas (string apa saja, dipakai sebagai partisi data — lihat `middleware/userAuth.ts`). Tidak ada endpoint register — provisioning token manual.

**Penting — dev server konek ke KV cloud asli, bukan simulasi lokal, lewat "mixed mode" (bukan `--remote` lagi).** Sejak Worker punya binding Durable Object (`RATE_LIMITER`, `USER_RATE_LIMITER`), wrangler v4 **tidak mengizinkan** `wrangler dev --remote` lagi ("wrangler dev --remote is no longer supported for Durable Objects"). Solusinya: binding `AUTH_TOKENS` di `wrangler.toml` ditandai `remote = true` — ini membuat KV konek ke cloud asli sementara Durable Object tetap simulasi lokal (satu Worker, sebagian binding lokal sebagian remote). Cukup jalankan `wrangler dev` biasa (**tanpa** `--remote`) — proyek ini sudah pin `wrangler` ke versi 4 di `package.json` supaya fitur ini didukung.

Konsekuensinya, mode mixed ini tetap butuh dua syarat akun Cloudflare yang sama seperti sebelumnya (biasanya sekali-jalan per akun):
- **workers.dev subdomain terdaftar** di akun kamu. Cek/daftar di `https://dash.cloudflare.com/<account-id>/workers/onboarding` (URL persisnya muncul di error wrangler kalau belum ada) — kalau sudah pernah bikin Worker apa pun sebelumnya, biasanya sudah otomatis ada.
- **KV namespace preview terpisah** dari production (lihat langkah 1 di bawah) — dev mixed mode memakai `preview_id`, bukan `id` production, demi keamanan.

Kalau kedua syarat itu belum ada, `wrangler dev` akan gagal start dengan pesan error yang jelas (baca pesannya, biasanya berisi link/perintah persis yang harus dijalankan).

**Catatan untuk perintah `wrangler kv key put/get/delete` manual** (langkah 3 & 5 di bawah): wrangler v4 defaultnya menulis/membaca ke KV **lokal** simulasi, BUKAN cloud, walau sudah pakai flag `--preview`. Wajib tambah flag `--remote` secara eksplisit setiap kali provisioning/mencabut token supaya benar-benar mengenai namespace cloud (lihat contoh perintah di bawah — semua sudah include `--remote`). **Begitu binding punya `id` DAN `preview_id` sekaligus** (seperti `AUTH_TOKENS` di `wrangler.toml` proyek ini), wrangler v4 juga akan menolak jalan tanpa penjelasan target eksplisit — wajib tambah `--preview false` untuk mengenai namespace **production** (field `id`), atau `--preview` (tanpa `false`) untuk namespace **preview/dev** (field `preview_id`).

1. Buat KV namespace production sekali (kalau belum ada): `wrangler kv namespace create AUTH_TOKENS`, tempel `id` yang muncul ke `wrangler.toml` (field `id`).
2. Buat KV namespace **preview** untuk dev (wajib, terpisah dari langkah 1): `wrangler kv namespace create AUTH_TOKENS --preview`, tempel `preview_id` yang muncul ke binding yang sama di `wrangler.toml` (jadi satu blok `[[kv_namespaces]]` punya `id` dan `preview_id`).
3. Generate token acak untuk tiap user (mis. `openssl rand -hex 24`), lalu simpan ke **kedua** namespace (production untuk deploy sungguhan, preview untuk dev lokal kamu sendiri) — **flag `--remote` wajib**, kalau lupa token hanya masuk ke KV simulasi lokal yang tidak pernah dibaca Worker sungguhan:
   ```
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>" --remote --preview false
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>" --remote --preview
   ```
4. Bagikan `<token-acak>` ke user lewat chat/dsb — mereka masukkan ke halaman Login di web app. `<user-id-bebas>` adalah partisi data komik user itu (`user_id` di setiap dokumen Astra), pilih string unik per orang (mis. nama).
5. Untuk mencabut akses: `wrangler kv key delete --binding=AUTH_TOKENS "<token-acak>" --remote --preview false` (ganti `--preview false` jadi `--preview` untuk mencabut dari namespace dev).

## Deploy

Sebelum `wrangler deploy`, set secret di Cloudflare (dijalankan sekali per environment):

```
cd apps/worker
wrangler secret put ASTRA_DB_API_ENDPOINT
wrangler secret put ASTRA_DB_APPLICATION_TOKEN
wrangler secret put ASTRA_DB_COLLECTION
wrangler secret put PROCESS_LOG_COLLECTION
wrangler secret put ALLOWED_ORIGINS   # mis. https://komik-tracker.pages.dev,http://localhost:5173
```

`ALLOWED_ORIGINS` (comma-separated) mempersempit CORS ke origin browser yang
sah — biasanya URL Cloudflare Pages web app + `http://localhost:5173` untuk dev.
Kalau kosong, Worker fallback ke `http://localhost:5173` saja (lihat
`src/index.ts`). Auth memakai `Authorization: Bearer` (bukan cookie), jadi ini
mengurangi permukaan, bukan menutup lubang CSRF.

Setelah `wrangler deploy`, provisioning token milikmu ke KV **production**
(field `id`, bukan `--preview`) supaya Worker ter-deploy mengenalinya:
`wrangler kv key put --binding=AUTH_TOKENS "<token>" "<user-id>" --remote --preview false`.
Web app di-host di Cloudflare Pages (`wrangler pages deploy apps/web/dist
--project-name komik-tracker`); build web dengan `VITE_WORKER_URL` menunjuk URL
Worker produksi (di-bake saat build, karena deploy Pages ini direct-upload
`dist`, bukan git-connected). SPA fallback disediakan `apps/web/public/_redirects`.

Tidak ada secret untuk AI: orkestrasi agent jalan di dalam Worker
(`src/agent/`) dan memanggil Gemini dengan **API key milik user**, dikirim
per-request dari client dan tidak pernah disimpan di server.

Opsional: `GEMINI_MODEL` bisa di-set (`wrangler secret put GEMINI_MODEL`, atau
sebagai plain var) untuk menimpa model default di `src/agent/geminiClient.ts`.
Ini hanya fallback global — user juga bisa memilih model sendiri per-request
lewat dropdown di halaman Tulis (dikirim di body `/agent/process`, prioritas di
atas `GEMINI_MODEL`). Daftar model diambil dari `POST /agent/models` yang
memanggil ListModels pakai API key user + digabung daftar kurasi di
`src/agent/models.ts`.

### Keep-alive Astra (cron)

`wrangler.toml` punya `[triggers] crons = ["0 3 * * *"]` — sekali sehari Worker
membaca ringan ke Astra (`src/scheduled.ts`) supaya DB free tier tidak
dihibernasi karena idle. Cron **hanya jalan di Worker yang sudah di-deploy**,
tidak di `wrangler dev`. Untuk mengetes handler-nya lokal:
`wrangler dev --test-scheduled`, lalu
`curl "localhost:8787/__scheduled?cron=0+3+*+*+*"`.

## Scripts

- `dev` — `wrangler dev` (mixed mode: KV `AUTH_TOKENS` konek ke cloud lewat `remote = true` di `wrangler.toml`, Durable Object tetap lokal — lihat "Setup Auth" di atas)
- `build` — `tsc -b`
- `deploy` — `wrangler deploy`
- `test` / `test:watch` — vitest
- `lint` — eslint
- `create-collection` — buat collection Astra DB `comics` kalau belum ada (baca `.dev.vars`, sekali jalan, bukan bagian dari hot path Worker)

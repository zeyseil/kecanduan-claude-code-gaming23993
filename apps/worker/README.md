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

**Penting — dev server jalan mode `--remote`, bukan lokal.** Script `dev` (`wrangler dev --remote`) sengaja dipakai supaya Worker lokal konek ke KV **cloud** asli, satu sumber kebenaran untuk token — bukan KV simulasi lokal yang datanya terpisah. Konsekuensinya, mode `--remote` butuh dua syarat akun Cloudflare (biasanya sekali-jalan per akun):
- **workers.dev subdomain terdaftar** di akun kamu. Cek/daftar di `https://dash.cloudflare.com/<account-id>/workers/onboarding` (URL persisnya muncul di error wrangler kalau belum ada) — kalau sudah pernah bikin Worker apa pun sebelumnya, biasanya sudah otomatis ada.
- **KV namespace preview terpisah** dari production (lihat langkah 1 di bawah) — Cloudflare menolak `--remote` memakai namespace production langsung untuk dev, demi keamanan.

Kalau kedua syarat itu belum ada, `wrangler dev` akan gagal start dengan pesan error yang jelas (baca pesannya, biasanya berisi link/perintah persis yang harus dijalankan).

1. Buat KV namespace production sekali (kalau belum ada): `wrangler kv namespace create AUTH_TOKENS`, tempel `id` yang muncul ke `wrangler.toml` (field `id`).
2. Buat KV namespace **preview** untuk dev (wajib, terpisah dari langkah 1): `wrangler kv namespace create AUTH_TOKENS --preview`, tempel `preview_id` yang muncul ke binding yang sama di `wrangler.toml` (jadi satu blok `[[kv_namespaces]]` punya `id` dan `preview_id`).
3. Generate token acak untuk tiap user (mis. `openssl rand -hex 24`), lalu simpan ke **kedua** namespace (production untuk deploy sungguhan, preview untuk dev lokal kamu sendiri):
   ```
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>"
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>" --preview
   ```
4. Bagikan `<token-acak>` ke user lewat chat/dsb — mereka masukkan ke halaman Login di web app. `<user-id-bebas>` adalah partisi data komik user itu (`user_id` di setiap dokumen Astra), pilih string unik per orang (mis. nama).
5. Untuk mencabut akses: `wrangler kv key delete --binding=AUTH_TOKENS "<token-acak>"` (tambah `--preview` juga kalau mau cabut dari namespace dev).

## Deploy

Sebelum `wrangler deploy`, set secret di Cloudflare (dijalankan sekali per environment):

```
cd apps/worker
wrangler secret put ASTRA_DB_API_ENDPOINT
wrangler secret put ASTRA_DB_APPLICATION_TOKEN
wrangler secret put ASTRA_DB_COLLECTION
```

## Scripts

- `dev` — `wrangler dev --remote` (lihat "Setup Auth" di atas untuk kenapa `--remote`, bukan default lokal)
- `build` — `tsc -b`
- `deploy` — `wrangler deploy`
- `test` / `test:watch` — vitest
- `lint` — eslint
- `create-collection` — buat collection Astra DB `comics` kalau belum ada (baca `.dev.vars`, sekali jalan, bukan bagian dari hot path Worker)

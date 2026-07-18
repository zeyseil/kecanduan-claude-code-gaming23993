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

`/comics` dan `/agent/process` sekarang butuh header `Authorization: Bearer <token>`. Token disimpan sebagai key di Cloudflare KV, value-nya `user_id` bebas (string apa saja, dipakai sebagai partisi data — lihat `middleware/userAuth.ts`). Tidak ada endpoint register — provisioning token manual:

1. Buat KV namespace sekali (kalau belum ada): `wrangler kv namespace create AUTH_TOKENS`, lalu tempel `id` yang muncul ke `wrangler.toml` (ganti `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`).
2. Generate token acak untuk tiap user (mis. `openssl rand -hex 24`), lalu simpan ke KV:
   ```
   wrangler kv key put --binding=AUTH_TOKENS "<token-acak>" "<user-id-bebas>"
   ```
   Untuk dev lokal (`wrangler dev`, KV lokal/miniflare), tambahkan flag `--local`. Untuk namespace production, jalankan tanpa `--local` (atau `--remote` tergantung versi wrangler).
3. Bagikan `<token-acak>` ke user lewat chat/dsb — mereka masukkan ke halaman Login di web app. `<user-id-bebas>` adalah partisi data komik user itu (`user_id` di setiap dokumen Astra), pilih string unik per orang (mis. nama).
4. Untuk mencabut akses: `wrangler kv key delete --binding=AUTH_TOKENS "<token-acak>"`.

## Deploy

Sebelum `wrangler deploy`, set secret di Cloudflare (dijalankan sekali per environment):

```
cd apps/worker
wrangler secret put ASTRA_DB_API_ENDPOINT
wrangler secret put ASTRA_DB_APPLICATION_TOKEN
wrangler secret put ASTRA_DB_COLLECTION
```

## Scripts

- `dev` — `wrangler dev`
- `build` — `tsc -b`
- `deploy` — `wrangler deploy`
- `test` / `test:watch` — vitest
- `lint` — eslint
- `create-collection` — buat collection Astra DB `comics` kalau belum ada (baca `.dev.vars`, sekali jalan, bukan bagian dari hot path Worker)

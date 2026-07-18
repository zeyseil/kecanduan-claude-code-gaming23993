# apps/worker

Cloudflare Worker (Hono) — backend perantara antara `apps/web` dan Astra DB.

## Setup Astra DB

1. Salin `.dev.vars.example` ke `.dev.vars` (gitignored) dan isi dengan kredensial Astra DB milikmu sendiri (Astra Console -> database -> tab "Connect" untuk API endpoint, "Generate Token" untuk application token).
2. Buat collection sekali (kalau belum ada di database Astra kamu):
   ```
   pnpm --filter worker run create-collection
   ```
3. Jalankan dev server: `pnpm --filter worker dev` (wrangler otomatis membaca `.dev.vars`).

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

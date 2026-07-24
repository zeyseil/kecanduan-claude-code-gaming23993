# komikcast-scraper

Layanan scraper **headless-browser** (patchright/Playwright + Chromium) untuk
Komikcast, dipakai sebagai calon **sumber cek-link-chapter** oleh komik-tracker
Worker. Berdiri sendiri (deploy Docker di Render), TIDAK bagian dari pnpm
workspace `apps/web`/`apps/worker`.

## Kenapa headless browser (bukan cheerio)

Komikcast (`v3.komikcast.fit`) dilindungi Cloudflare — fetch server polos balas
**403 / "Just a moment…"**. Scraper cheerio/axios tidak bisa menyelesaikan
JS-challenge. Hanya Chromium asli (di sini via `patchright`, Playwright yang
di-patch anti-deteksi) yang punya peluang melewatinya.

## ⚠️ Risiko yang disadari (baca sebelum berharap banyak)

1. **Memori.** Render free tier = **512MB**. Chromium sendiri butuh ~500MB untuk
   satu halaman dan bocor memori seiring waktu → **rawan OOM / restart loop**.
   Mitigasi sudah dipasang (`--disable-dev-shm-usage`, `--single-process`,
   tutup context tiap request, browser tunggal), tapi tidak dijamin cukup. Kalau
   OOM: pakai instance Render lebih besar (berbayar) atau host lain.
2. **Cloudflare 2026.** Managed Challenge / Turnstile bisa **tetap menang** walau
   pakai headless. Ini hanya bisa dibuktikan **dari IP Render** (datacenter),
   bukan dari laptop. Tombol tuning utama kalau gagal: naikkan `patchright` +
   base image Playwright **bersamaan** ke versi terbaru (anti-deteksi lebih baru)
   — `package.json` `patchright` dan tag `FROM mcr.microsoft.com/playwright:vX-noble`
   di `Dockerfile` harus versi yang sama.
3. **Egress-IP.** Sukses dari laptop (IP rumah) **≠** sukses dari Render (IP
   datacenter yang lebih sering diblokir). Uji sejati = curl ke URL Render.
4. **Selector rapuh.** `src/komikcast.js` memakai selector best-effort tema
   Komikcast — **belum diverifikasi ke situs live** (Cloudflare menghalangi cek
   otomatis). Wajib dicek ulang setelah deploy (lihat "Verifikasi").
5. **Domain rotasi.** Komikcast sering ganti domain — override lewat
   `KOMIKCAST_BASE_URL` tanpa ubah kode.

## Endpoint

| Method | Path | Balasan |
|--------|------|---------|
| GET | `/health` | `{ ok: true }` |
| GET | `/search?q=<judul>` | `{ results: [{ title, slug }] }` |
| GET | `/chapters?slug=<slug>` | `{ chapters: [{ chapterNumber, url }] }` (list penuh, belum diurut) |

Logika "cari chapter berikutnya" (argmin > chapter tersimpan) **tidak** di sini —
itu tugas Worker nanti (konsisten pola `kiryuuChapters.ts`/`komikuChapters.ts`).

Kalau `SCRAPER_SECRET` di-set, semua endpoint kecuali `/health` butuh header
`X-Scraper-Secret` yang cocok.

## Env

| Var | Wajib | Default | Keterangan |
|-----|-------|---------|------------|
| `KOMIKCAST_BASE_URL` | tidak | `https://v3.komikcast.fit` | domain Komikcast (override saat rotasi) |
| `SCRAPER_SECRET` | disarankan | — | shared-secret; kosong = endpoint publik |
| `PORT` | tidak | `10000` | Render meng-inject sendiri |
| `SINGLE_PROCESS` | tidak | `true` | set `false` kalau Chromium crash |
| `NAV_TIMEOUT_MS` | tidak | `45000` | tunggu challenge Cloudflare selesai |

## Jalankan lokal (Docker, simulasi 512MB Render)

```bash
cd services/komikcast-scraper
docker build -t komikcast-scraper .
# --memory=512m mensimulasikan batas RAM Render free tier
docker run --rm -p 10000:10000 --memory=512m --shm-size=64m \
  -e SCRAPER_SECRET=dev-secret komikcast-scraper

# di terminal lain:
curl localhost:10000/health
curl -H "X-Scraper-Secret: dev-secret" "localhost:10000/search?q=solo+leveling"
curl -H "X-Scraper-Secret: dev-secret" "localhost:10000/chapters?slug=<slug-dari-search>"
```

> Sukses lokal **belum membuktikan apa-apa** soal Cloudflare (IP rumah ≠ IP
> Render). Yang lokal ini hanya untuk cek selector benar & RAM tidak langsung
> meledak di 512MB.

## Deploy ke Render

1. Push repo ke GitHub (sudah).
2. Render dashboard → **New → Web Service** → connect repo ini.
3. **Root Directory:** `services/komikcast-scraper` · **Runtime:** Docker ·
   **Instance:** Free.
4. Env vars: `KOMIKCAST_BASE_URL`, `SCRAPER_SECRET` (isi string acak). Opsional
   `SINGLE_PROCESS=false` kalau nanti crash.
5. Health check path: `/health`.
6. Deploy, tunggu build (Chromium ~beberapa menit).

(Atau pakai `render.yaml` sebagai Blueprint.)

## Verifikasi (uji sejati — dari luar, ke URL Render)

```bash
curl "https://<nama>.onrender.com/health"
curl -H "X-Scraper-Secret: <secret>" \
  "https://<nama>.onrender.com/search?q=solo+leveling"
```

- **Balas JSON `results` berisi data** → Cloudflare **terlewati dari IP Render**
  (tembok utama teratasi). Lanjut: buka salah satu `url` chapter di browser untuk
  memastikan pola URL benar, lalu integrasikan ke Worker (sesi terpisah).
- **`scrape_failed` / hasil kosong / log "Just a moment…"** → Cloudflare menang.
- **Log Render "Out of memory" / restart loop** → OOM (tembok memori).

Kalau gagal: **tidak ada yang rusak** di komik-tracker — layanan ini belum
tersambung ke Worker. Cukup catat sebagai dead-end.

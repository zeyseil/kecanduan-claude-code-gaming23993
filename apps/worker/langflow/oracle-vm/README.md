# Langflow — Comic Tracker Agent (Oracle Cloud Always Free VM)

Instance Langflow yang mengorkestrasi AI agent pencatat komik, di-deploy ke
VM Oracle Cloud Always Free lewat Docker Compose. Panduan lengkap
(provisioning VM, hardening, deploy) ada di `../ORACLE_DEPLOY.md`.

Beda dari platform PaaS (HF Spaces, Koyeb — dua opsi yang dicoba lebih dulu
dan gagal, lihat `../ORACLE_DEPLOY.md` bagian "Riwayat"): di sini **tidak ada
build otomatis dari Git**. Anda men-download/clone folder ini ke VM sendiri
lalu `docker compose up -d` secara manual.

## Isi folder

- `docker-compose.yml` — 2 service: `langflow` (tidak di-expose langsung ke
  publik) + `caddy` (reverse proxy, otomatis HTTPS lewat Let's Encrypt).
- `Caddyfile` — ganti domain contoh dengan domain Anda sendiri.
- `.env.example` — salin ke `.env` di VM (gitignored di level VM, jangan
  commit), isi kredensial asli.

## Kenapa tetap pakai Neon (bukan Postgres lokal di VM)

VM Oracle punya disk persisten sungguhan, jadi secara teori bisa jalankan
Postgres lokal di VM juga. Tapi Neon sudah terverifikasi jalan (Tahap 1,
34 tabel Langflow terkonfirmasi), dan memisahkan data dari lifecycle VM
punya nilai sendiri (kalau VM perlu di-rebuild/reprovisioning karena capacity
issue, data tidak ikut hilang). Tidak diganti tanpa alasan kuat.

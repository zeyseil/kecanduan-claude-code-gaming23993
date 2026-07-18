---
title: Komik Tracker Langflow
emoji: 📚
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Langflow — Comic Tracker Agent (Hugging Face Space)

Instance Langflow yang mengorkestrasi AI agent pencatat komik. Space ini jalan
24/7 di cloud HF sehingga laptop tidak perlu menyala. **File di folder ini
(`Dockerfile` + `README.md` ini) disalin ke repo Space HF Anda**, bukan
di-deploy dari repo aplikasi utama.

Panduan lengkap setup (Postgres, Secrets, keep-alive) ada di
`../HF_DEPLOY.md`. Ringkasnya:

## Kenapa perlu Postgres eksternal

Filesystem HF Spaces **ephemeral** — setiap Space restart, SQLite bawaan
Langflow (berisi flow, credential, node yang Anda buat) **hilang total**. Karena
itu Langflow WAJIB diarahkan ke Postgres eksternal (Neon free tier) lewat
`LANGFLOW_DATABASE_URL`. Tanpa ini, flow Anda lenyap diam-diam saat restart.

## Space Secrets yang wajib diisi

Set di **Settings → Variables and secrets** (bukan hardcode di Dockerfile):

| Secret | Isi |
|---|---|
| `LANGFLOW_DATABASE_URL` | Connection string Neon: `postgresql://...?sslmode=require` |
| `LANGFLOW_AUTO_LOGIN` | `false` (mengunci UI publik — wajib, Space free selalu public) |
| `LANGFLOW_SUPERUSER` | username admin pilihan Anda |
| `LANGFLOW_SUPERUSER_PASSWORD` | password admin kuat |
| `LANGFLOW_SECRET_KEY` | string acak (enkripsi credential internal Langflow) |
| `WORKER_BASE_URL` | URL Worker production, mis. `https://komik-tracker-worker.<sub>.workers.dev` |
| `INTERNAL_TOOLS_SECRET` | sama persis dengan yang di `.dev.vars`/`wrangler secret` Worker |

`WORKER_BASE_URL` dan `INTERNAL_TOOLS_SECRET` dibaca oleh 6 tool component lewat
`os.getenv(...)` (lihat `../README.md`) — tidak lagi diketik di tiap node.

# Deploy Langflow ke Hugging Face Spaces

Panduan memindahkan Langflow dari lokal (sering disconnect) ke HF Spaces yang
jalan 24/7. Dikerjakan berurutan — **Tahap 1 dulu, jangan dilewati.**

## Kenapa HF Spaces (dan batasannya)

HF Spaces bisa menjalankan Docker arbitrer, jadi Langflow bisa jalan di sana
gratis. Tapi klaim "24/7 mandiri" tidak sepenuhnya benar di free tier:

| Kendala free tier | Mitigasi |
|---|---|
| Space tidur setelah ~48 jam idle | Keep-alive ping (Tahap 4) |
| Filesystem ephemeral — SQLite hilang tiap restart | Postgres eksternal / Neon (Tahap 1) |
| Space free wajib public | `LANGFLOW_AUTO_LOGIN=false` + superuser (Tahap 2) |
| Cold start 1–3 menit | Diterima; ping mengurangi frekuensi |

Alternatif yang ditolak: Railway/Render free sleep ~15 menit (jauh lebih agresif)
dan Render free tanpa persistent disk; VPS ~$5/bln lebih andal tapi berbayar +
maintenance OS. HF menang karena idle window paling longgar dan benar-benar gratis.

---

## Tahap 1 — Postgres eksternal (Neon)

Tanpa ini Space jadi jebakan: flow hilang diam-diam saat restart.

1. Buat project di [neon.tech](https://neon.tech) (free tier).
   **Pakai Neon, BUKAN Supabase** — Supabase free mem-*pause* project setelah 7
   hari idle (mengulang persis masalah yang mau dihindari); Neon hanya
   scale-to-zero dengan auto-wake.
2. Ambil connection string: `postgresql://user:pass@host/db?sslmode=require`.
3. **Uji di Langflow lokal dulu** sebelum menyentuh HF:
   ```
   export LANGFLOW_DATABASE_URL="postgresql://...?sslmode=require"
   langflow run
   ```
   Buat/import flow, restart `langflow run`, pastikan flow masih ada. Kalau ini
   jalan lokal, HF tinggal pakai env yang sama.

---

## Tahap 2 — Buat Space HF

1. huggingface.co → New Space → **SDK: Docker**, visibility Public (free).
2. Salin `hf-space/Dockerfile` dan `hf-space/README.md` (folder ini) ke repo Space.
3. Settings → Variables and secrets, isi semua **Space Secrets** (lihat tabel di
   `hf-space/README.md`): `LANGFLOW_DATABASE_URL`, `LANGFLOW_AUTO_LOGIN=false`,
   `LANGFLOW_SUPERUSER`, `LANGFLOW_SUPERUSER_PASSWORD`, `LANGFLOW_SECRET_KEY`,
   `WORKER_BASE_URL`, `INTERNAL_TOOLS_SECRET`.
4. Tunggu build. Buka URL Space → harus muncul **layar login** Langflow (bukti
   `LANGFLOW_AUTO_LOGIN=false` bekerja), login dengan superuser.
5. Import/bangun flow (lihat `README.md` folder ini untuk kode 6 tool component +
   system prompt). Karena secret dibaca dari env, field `worker_base_url` /
   `internal_secret` di tiap node **dibiarkan kosong**.

---

## Tahap 3 — Sambungkan Worker ke Langflow HF

Di `.dev.vars` (dev) dan `wrangler secret put` (production):

- `LANGFLOW_API_URL=https://<user>-<space>.hf.space/api/v1/run/<flow-id>`
- `LANGFLOW_API_KEY=<API key dari Langflow HF>` (bukan yang lokal)

`agent.ts` tidak berubah — ia sudah balas `502` (bukan crash) kalau Langflow
tidak bisa dihubungi atau membalas non-OK. **Catatan cold start:** request
pertama ke Space yang tidur bisa >60 detik; verifikasi apakah balas sukses
(lambat) atau timeout, dan sesuaikan pesan error kalau perlu (lihat Verifikasi).

---

## Tahap 4 — Keep-alive ping (sudah dikodekan di Worker)

Sudah diimplementasi: cron trigger di `wrangler.toml` (`*/30 * * * *`) +
handler `scheduled` di `src/index.ts` yang nge-ping `LANGFLOW_HEALTH_URL`.

Yang perlu Anda lakukan: set secret health URL Space:

```
wrangler secret put LANGFLOW_HEALTH_URL
# isi: https://<user>-<space>.hf.space/health
```

Kalau kosong, handler no-op (aman untuk dev lokal). Verifikasi jalannya lewat
`wrangler tail` — log `keep-alive: ... -> 200` muncul tiap 30 menit.

---

## Verifikasi end-to-end

1. **Persistensi**: restart Space (Settings → Restart) → flow + 6 node masih ada.
   Tes paling penting; kalau gagal, `LANGFLOW_DATABASE_URL` belum benar.
2. **Terkunci**: buka URL Space di incognito → layar login, bukan kanvas flow.
3. **Secret dari env**: di Playground Langflow, jalankan `cari_komik_mirip` tanpa
   mengisi field `internal_secret` → tetap sukses (bukti `os.getenv` terbaca).
4. **Lewat Worker**: `curl POST /agent/process` dengan token user + Google API key
   asli, input komik baru → cek Astra: comic dibuat, `cover_url` terisi (butuh
   node `set_cover` sudah terpasang), `process_log` tercatat.
5. **Cold start**: biarkan Space tidur, panggil `/agent/process` → catat sukses
   lambat vs 502; perbaiki error message/retry kalau perlu.
6. **Cron**: `wrangler tail` → log ping tiap 30 menit.

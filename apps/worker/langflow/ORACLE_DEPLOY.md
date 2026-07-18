# Deploy Langflow ke Oracle Cloud Always Free (VM)

Panduan menjalankan Langflow 24/7 di VM Oracle Cloud Always Free —
menggantikan Hugging Face Spaces dan Koyeb (lihat "Riwayat" di bawah).
Dikerjakan berurutan — **Tahap 1 (Neon) sudah selesai, mulai dari Tahap 2.**

## Riwayat keputusan (kenapa bukan HF/Koyeb)

1. Rencana awal: **Hugging Face Spaces**. Dibatalkan — Docker/Gradio Space
   kini butuh langganan HF PRO berbayar di akun user, bertentangan dengan
   asumsi awal "gratis".
2. Rencana kedua: **Koyeb**. Dibatalkan — Koyeb diakuisisi Mistral AI
   (Februari 2026), sign-up baru untuk tier gratis/Starter ditutup
   (dashboard akun baru mentok di halaman kosong "Koyeb is joining Mistral").
3. Rencana ketiga (dipakai): **Oracle Cloud Always Free**, dikonfirmasi
   langsung ke `docs.oracle.com` — bukan PaaS seperti dua opsi sebelumnya,
   tapi VM ARM sungguhan, **selamanya gratis** (bukan trial 30 hari/$300
   kredit — itu program terpisah), 2 OCPU + 12GB RAM total, **tidak pernah
   sleep**. Trade-off: user kelola VM sendiri (SSH, Docker, firewall),
   kartu kredit wajib saat sign-up (verifikasi, tidak ditagih selama di
   batas Always Free), dan provisioning shape A1 sering "Out of Capacity"
   di region tertentu (ada mitigasi, lihat Tahap 2).

---

## Tahap 1 — Postgres eksternal (Neon) — SELESAI

Sudah diverifikasi: Langflow Desktop lokal user tersambung ke Neon, 34 tabel
(`flow`, `user`, `variable`, dst) terkonfirmasi lewat query langsung ke Neon.
VM Oracle akan memakai `LANGFLOW_DATABASE_URL` yang sama — lihat catatan
troubleshooting (driver `psycopg2-binary`, sinkronisasi `.env` Langflow
Desktop) di riwayat sesi kalau perlu setup ulang di environment lain.

---

## Tahap 2 — Provisioning VM

1. Sign up di [cloud.oracle.com](https://cloud.oracle.com) (kartu kredit
   untuk verifikasi — tidak ditagih selama tetap di batas Always Free).
2. **Home Region: Frankfurt** (dipilih untuk sesi ini — 3 Availability
   Domain, latensi wajar dipanggil dari Worker Cloudflare global). Home
   Region **tidak bisa diganti mudah setelah sign-up** — pastikan benar
   sebelum lanjut.
3. Compute → Create Instance:
   - Image: **Ubuntu** (versi LTS terbaru yang tersedia).
   - Shape: **VM.Standard.A1.Flex**, alokasikan semua Always Free (**2
     OCPU, 12GB RAM**) ke 1 instance ini.
   - Boot volume: default (~47GB, termasuk Always Free).
   - Simpan SSH key yang di-generate/upload — dipakai untuk akses VM.
4. **Kalau muncul error "Out of Capacity"**: ini masalah umum untuk shape
   A1, bukan kesalahan konfigurasi Anda. Dua tool komunitas untuk retry
   otomatis lintas Availability Domain sampai capacity tersedia:
   - [`oci-arm-host-capacity`](https://github.com/hitrov/oci-arm-host-capacity)
   - [`oracle-cloud-repeater`](https://github.com/sam-bee/oracle-cloud-repeater)

   Ikuti README masing-masing tool (butuh OCI CLI + API key user, bukan
   sesuatu yang bisa dijalankan dari sesi ini). Retry bisa makan waktu
   beberapa jam sampai hari tergantung keberuntungan capacity.
5. Setelah instance jalan, catat **IP publik**-nya.

---

## Tahap 3 — Hardening dasar VM

Default Oracle memblokir SEMUA inbound traffic kecuali SSH — dua lapis
firewall harus dibuka (cloud-level DAN OS-level), keduanya wajib:

1. **Security List / Network Security Group** (OCI Console, di VCN instance
   ini): tambah **Ingress Rule** untuk port **443** dan **80** (source
   `0.0.0.0/0`, untuk Let's Encrypt HTTP-01 challenge + HTTPS). **Jangan**
   buka port 7860 (Langflow) ke publik — hanya Caddy (443) yang boleh.
2. SSH ke VM (`ssh ubuntu@<ip-publik>`), buka firewall OS (Ubuntu pakai
   `ufw` atau `iptables` tergantung image):
   ```
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
3. Install Docker + Docker Compose plugin:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   # logout/login supaya grup docker berlaku
   ```
4. Siapkan DNS: arahkan subdomain (mis. `langflow.domain-anda.com`) ke IP
   publik VM lewat A record — Caddy butuh ini untuk sertifikat Let's
   Encrypt otomatis. Kalau belum punya domain, lihat catatan `tls internal`
   di `oracle-vm/Caddyfile`.

---

## Tahap 4 — Deploy Langflow

1. Salin folder `apps/worker/langflow/oracle-vm/` ke VM (scp, atau `git
   clone` repo ini di VM kalau public/punya akses).
2. Edit `oracle-vm/Caddyfile` — ganti domain contoh dengan domain Anda.
3. `cp .env.example .env`, isi kredensial asli (`LANGFLOW_DATABASE_URL` dari
   Neon, `LANGFLOW_SUPERUSER`/`LANGFLOW_SUPERUSER_PASSWORD`/
   `LANGFLOW_SECRET_KEY`, `WORKER_BASE_URL`, `INTERNAL_TOOLS_SECRET`).
4. `docker compose up -d` di folder `oracle-vm/`.
5. Buka `https://langflow.domain-anda.com` → harus muncul **layar login**
   Langflow (bukti `LANGFLOW_AUTO_LOGIN=false` bekerja) dengan sertifikat
   TLS valid (Caddy sudah urus otomatis).
6. Login, bangun/import flow (lihat `../README.md` untuk kode 6 tool
   component + system prompt, termasuk node `set_cover` yang masih
   tertunda dari sesi sebelumnya). Field `worker_base_url`/`internal_secret`
   di tiap node **dibiarkan kosong** (dibaca dari env lewat `os.getenv`).

---

## Tahap 5 — Sambungkan Worker ke Langflow VM

Di `.dev.vars` (dev) dan `wrangler secret put` (production):

- `LANGFLOW_API_URL=https://langflow.domain-anda.com/api/v1/run/<flow-id>`
- `LANGFLOW_API_KEY=<API key dari Langflow di VM>`
- `LANGFLOW_HEALTH_URL=https://langflow.domain-anda.com/health` (opsional
  — VM tidak pernah sleep, jadi cron keep-alive **tidak lagi wajib**
  mencegah sleep seperti di rencana HF/Koyeb, tapi tetap berguna sebagai
  monitoring uptime ringan; boleh dikosongkan kalau tidak perlu).

`agent.ts` tidak berubah — sudah balas `502` (bukan crash) kalau Langflow
tidak bisa dihubungi atau membalas non-OK.

---

## Verifikasi end-to-end

1. **VM tidak sleep**: cek uptime VM setelah 2+ jam idle tanpa traffic sama
   sekali — harus tetap responsif (beda mendasar dari PaaS free tier).
2. **Firewall benar**: `curl https://langflow.domain-anda.com` → sukses;
   `curl http://<ip-publik>:7860` dari luar → harus timeout/refused (bukti
   Langflow tidak ter-expose langsung, hanya lewat Caddy).
3. **Persistensi Postgres**: `docker compose restart langflow` (atau
   `sudo reboot` VM) → flow + 6 node tool masih ada setelah container/VM
   naik lagi.
4. **Auto-start setelah reboot**: `sudo reboot`, tunggu VM up, cek
   `docker compose ps` → kedua service `Up` tanpa intervensi manual (bukti
   `restart: always` bekerja).
5. **Secret dari env**: di Playground Langflow, jalankan `cari_komik_mirip`
   tanpa mengisi field `internal_secret` → tetap sukses (bukti `os.getenv`
   terbaca dari `.env` compose).
6. **RAM**: `docker stats` saat Langflow idle vs memproses request — jauh
   di bawah 12GB (beda dari risiko OOM di rencana Koyeb 512MB).
7. **Lewat Worker**: `curl POST /agent/process` dengan token user + Google
   API key asli, input komik baru → cek Astra: comic dibuat, `cover_url`
   terisi (butuh node `set_cover` sudah terpasang), `process_log` tercatat.

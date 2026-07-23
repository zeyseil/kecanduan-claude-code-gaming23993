# Komik Tracker

Aplikasi personal pencatat komik terbaca — mencatat judul, jenis, chapter terakhir, status, dan cover — dengan **AI agent** yang mengotomasi pencatatan dari input teks bebas (mis. "baru baca Solo Leveling ch 120"). Satu codebase React, dibungkus untuk **Web**, **Desktop (Tauri)**, dan **Android (Capacitor)**.

- 🌐 Web: <https://komik-tracker.pages.dev>
- ⚙️ Worker (API): <https://komik-tracker-worker.sulthon-rasyidin.workers.dev>

> Aplikasi ini belum dipublikkan untuk umum — akses butuh token yang diberikan admin (lihat [Autentikasi](#autentikasi--token)).

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Arsitektur & Stack](#arsitektur--stack)
- [Struktur Repo](#struktur-repo)
- [Prasyarat](#prasyarat)
- [Setup Awal](#setup-awal)
- [Menjalankan Secara Lokal (Dev)](#menjalankan-secara-lokal-dev)
- [Test, Lint, Build](#test-lint-build)
- [Autentikasi & Token](#autentikasi--token)
- [Deploy ke Cloudflare](#deploy-ke-cloudflare)
- [Build Aplikasi Desktop (Tauri)](#build-aplikasi-desktop-tauri)
- [Build Aplikasi Android (Capacitor)](#build-aplikasi-android-capacitor)
- [Dokumen Lain](#dokumen-lain)

---

## Fitur Utama

- **Daftar Komik** — grid visual (cover, judul, badge jenis, chapter, status, waktu update), sort/filter/search (command palette `Ctrl/Cmd+K`), hero banner "Lanjutkan Membaca", sidebar statistik/aktivitas/jadwal rilis, paginasi.
- **Tulis (AI agent)** — tempel teks bebas, Gemini mengekstrak judul/chapter/jenis lalu membuat/meng-update entry lewat tool-calling deterministik (cari komik mirip → buat/update → cari cover → simpan cover → log). API key Gemini milik masing-masing user (device-only, tidak disimpan di server).
- **Import historis massal** — parser toleran untuk format catatan lama, koreksi nama per-entri, auto-deteksi jenis + cover.
- **Cover otomatis** — di-fetch dari sumber publik: MangaDex → comick.dev → AniList → Komiku. Fallback upload manual (drag-drop + crop 3:4).
- **Cari link chapter berikutnya** — cari URL baca chapter setelah chapter tersimpan dari 5 sumber: **comick.dev**, **MangaDex** (Inggris), **Shinigami**, **Komiku**, **Kiryuu** (Indonesia).
- **Baca di dalam app** — di Desktop (Tauri) membuka window baca + companion always-on-top; di Android membuka in-app Custom Tab; di Web tab baru.
- **Mode Aman** — sensor blur cover 18+ (per-device, default ON).
- **Dashboard Admin** (`/admin`, role admin) — kesehatan sistem, kelola token user, statistik agregat (metadata-only, tanpa judul/isi komik user lain).
- **Multi-platform** — Web (Cloudflare Pages), Desktop (`.msi`/`.exe`), Android (`.apk`).

---

## Arsitektur & Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind 3 |
| Desktop wrapper | Tauri v2 (Rust) |
| Android wrapper | Capacitor 7 |
| Backend perantara | Cloudflare Worker (Hono) + Durable Objects (rate-limit) |
| Orkestrasi AI | **Di dalam Worker** — Google Gemini function calling langsung (`apps/worker/src/agent/`) |
| Database | Astra DB (Cassandra-compatible, via Astra Data API) |
| Auth | Token per-user di Cloudflare KV (`Authorization: Bearer`) |
| Hosting web | Cloudflare Pages |

**Alur:** Web/Desktop/Android (React) → `Authorization: Bearer <token>` → Cloudflare Worker → Astra DB. Untuk fitur AI, Worker memanggil Gemini REST dengan API key milik user (transit per-request, tidak pernah disimpan). Cover/chapter di-scrape dari sumber publik oleh Worker.

> **Catatan sejarah:** orkestrasi AI dulu memakai Langflow (di-host di berbagai platform) — sudah **dihapus total** dan dipindah ke dalam Worker (Gemini function calling) setelah rangkaian kegagalan hosting + bug. Arsip ada di branch `archive/langflow-orchestration`. README/CLAUDE.md adalah sumber kebenaran terkini.

---

## Struktur Repo

Monorepo **pnpm workspaces**:

```
komik-tracker/
├─ apps/
│  ├─ web/                # React app (Vite) — UI semua platform
│  └─ worker/             # Cloudflare Worker (Hono) — API + AI agent + Astra
├─ src-tauri/             # Wrapper Desktop (Tauri v2, Rust)
├─ android/               # Wrapper Android (Capacitor project)
├─ capacitor.config.ts    # Konfigurasi Capacitor
├─ assets/                # Sumber icon/splash
├─ PRD.md · SPEC.md · TOOL_CONTRACTS.md   # Dokumen produk/arsitektur
└─ CLAUDE.md              # Log kerja + keputusan desain (sangat detail)
```

---

## Prasyarat

- **Node.js** ≥ 18 (dites di 20/21)
- **pnpm** 9.15.9 — `corepack enable && corepack use pnpm@9.15.9`, atau `npx pnpm@9.15.9`
- **Akun Cloudflare** (untuk deploy Worker/Pages) + **Astra DB** (database)
- **API key Google Gemini** per user — dari <https://aistudio.google.com/apikey>
- Khusus **build Desktop**: Rust toolchain (`rustup`) + MSVC Build Tools (Windows)
- Khusus **build Android**: Android SDK (Platform 35 + build-tools) + JDK 17/21 (mis. JBR bawaan Android Studio)

---

## Setup Awal

```bash
# 1. Install dependency seluruh workspace
pnpm install

# 2. Konfigurasi Worker (kredensial Astra & env) — lihat apps/worker/README.md
cd apps/worker
cp .dev.vars.example .dev.vars   # lalu isi kredensial Astra kamu sendiri
pnpm --filter worker run create-collection   # buat collection Astra sekali

# 3. (opsional) contoh env web
cd ../web
cp .env.example .env             # VITE_WORKER_URL, default http://localhost:8787
```

`.dev.vars` (worker) dan `.env` (web) **gitignored** — kredensial diisi sendiri, tidak pernah di-commit. Detail lengkap setup Astra, KV, dan token ada di [`apps/worker/README.md`](apps/worker/README.md).

---

## Menjalankan Secara Lokal (Dev)

Butuh **dua** proses jalan bersamaan: Worker (API) dan Web (UI).

```bash
# Terminal 1 — Worker di http://localhost:8787
pnpm --filter worker dev

# Terminal 2 — Web di http://localhost:5173
pnpm --filter web dev
# atau dari root: pnpm dev
```

Lalu buka <http://localhost:5173>, login dengan token (lihat [Autentikasi](#autentikasi--token)).

> **Penting (Worker dev = "mixed mode"):** `wrangler dev` konek ke KV **cloud** asli untuk token (binding `AUTH_TOKENS` ditandai `remote = true`), sementara Durable Object tetap simulasi lokal. Jadi token harus di-provisioning ke KV cloud (namespace **preview**) dulu agar login lokal berhasil. `wrangler dev --remote` **tidak** dipakai lagi (tidak didukung wrangler v4 dengan Durable Object). Lengkapnya di [`apps/worker/README.md`](apps/worker/README.md).

---

## Test, Lint, Build

```bash
# Web
pnpm --filter web test      # vitest
pnpm --filter web lint      # eslint
pnpm --filter web build     # tsc -b && vite build → apps/web/dist

# Worker
pnpm --filter worker test
pnpm --filter worker lint
pnpm --filter worker build  # tsc -b
```

Semua gate harus hijau sebelum deploy/rilis.

---

## Autentikasi & Token

Aplikasi tidak punya registrasi mandiri. Setiap user butuh **token** yang disimpan sebagai key di Cloudflare KV (`AUTH_TOKENS`). Token dikirim tiap request lewat header `Authorization: Bearer <token>`.

- **Provisioning token biasa** (role `user`): bisa dari **dashboard Admin** di web, atau lewat `wrangler` (lihat worker README).
- **Role admin**: HANYA bisa diberikan lewat `wrangler` (JSON value `{"user_id":"...","role":"admin"}`) — tidak pernah dari browser.
- **Login**: user membuka halaman `/login`, tempel token → data komik-nya (dipartisi per `user_id`) termuat.

Langkah `wrangler kv namespace create` + `wrangler kv key put` lengkap (termasuk jebakan flag `--remote`/`--preview` di wrangler v4) ada di [`apps/worker/README.md`](apps/worker/README.md#setup-auth-token-per-user).

---

## Deploy ke Cloudflare

### 1. Worker (API)

```bash
cd apps/worker

# Set secret sekali per environment (kredensial Astra kamu):
wrangler secret put ASTRA_DB_API_ENDPOINT
wrangler secret put ASTRA_DB_APPLICATION_TOKEN
wrangler secret put ASTRA_DB_COLLECTION
wrangler secret put PROCESS_LOG_COLLECTION
wrangler secret put ALLOWED_ORIGINS   # mis. https://komik-tracker.pages.dev,http://localhost:5173,http://tauri.localhost,https://localhost
# opsional: wrangler secret put GEMINI_MODEL

# Deploy
pnpm --filter worker deploy   # = wrangler deploy
```

`ALLOWED_ORIGINS` (comma-separated) mempersempit CORS. Nilai produksi saat ini memuat origin Pages, dev localhost, Tauri (`http://tauri.localhost`), dan Android WebView (`https://localhost`).

Cek: `curl https://<worker-url>/` → `200`, `curl https://<worker-url>/comics` (tanpa token) → `401`.

### 2. Web (Cloudflare Pages)

Build dengan `VITE_WORKER_URL` menunjuk Worker produksi (di-**bake** saat build karena Pages ini direct-upload `dist`, bukan git-connected), lalu deploy ke branch `main` project.

```bash
# dari root repo
VITE_WORKER_URL="https://komik-tracker-worker.sulthon-rasyidin.workers.dev" pnpm --filter web build

wrangler pages deploy apps/web/dist --project-name komik-tracker --branch main
```

> **Penting:** `--branch main` wajib agar update mengenai **domain produksi** (`komik-tracker.pages.dev`). Tanpa itu, deploy jadi preview URL acak. SPA deep-link (`/login`, `/tulis`, `/admin`) ditangani `apps/web/public/_redirects`.

Verifikasi: `curl https://komik-tracker.pages.dev/` → `200`, dan bundle JS-nya memuat URL Worker produksi.

---

## Build Aplikasi Desktop (Tauri)

Menghasilkan installer Windows (`.msi` + `.exe`). Desktop **selalu** connect ke Worker produksi (URL di-bake dari `apps/web/.env.tauri` lewat `build:tauri`).

```bash
# Prasyarat: Rust toolchain + MSVC Build Tools terpasang
pnpm tauri:build
```

Output:
```
src-tauri/target/release/bundle/msi/komik-tracker_<versi>_x64_en-US.msi
src-tauri/target/release/bundle/nsis/komik-tracker_<versi>_x64-setup.exe
```

Untuk dev interaktif (window Tauri, hot-reload UI, ke Worker produksi): `pnpm tauri:dev`.

Catatan:
- Instalasi pertama memunculkan Windows SmartScreen "Unknown Publisher" — normal, belum ada code signing.
- Bundle identifier: `com.zeyseil.komik-tracker`. Icon dari `apps/web/public/icon.png` (regenerate: `pnpm tauri icon apps/web/public/icon.png`).
- Tidak ada auto-update — update = rebuild + reinstall.

---

## Build Aplikasi Android (Capacitor)

Menghasilkan APK. Android juga **selalu** connect ke Worker produksi (URL di-bake saat `pnpm --filter web build`).

```bash
# 1. Build web dengan Worker produksi + sync ke project Android
VITE_WORKER_URL="https://komik-tracker-worker.sulthon-rasyidin.workers.dev" pnpm --filter web build
npx cap sync android

# 2. Pastikan android/local.properties berisi path SDK kamu (forward slash!)
#    sdk.dir=D:/android-sdk   (file ini gitignored, isi sendiri)

# 3. Build APK debug
cd android
JAVA_HOME="<path>/Android Studio/jbr" ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

Catatan:
- **Debug APK** langsung bisa di-sideload (aktifkan "Install from unknown sources" di HP). Untuk **release/Play Store** perlu keystore/signing (belum digarap).
- App ID Android: `com.zeyseil.komiktracker` (tanpa tanda hubung).
- Jika build gagal `Unable to establish loopback connection` / kehabisan disk: arahkan `GRADLE_USER_HOME` dan `TEMP`/`TMP` ke drive yang lega (mis. `D:`), pakai `--no-daemon`.

---

## Dokumen Lain

- [`CLAUDE.md`](CLAUDE.md) — log kerja per-slice + prinsip desain yang sudah diputuskan (sumber kebenaran paling detail). **Baca sebelum mengerjakan fitur baru.**
- [`PRD.md`](PRD.md) — latar belakang & tujuan produk
- [`SPEC.md`](SPEC.md) — spesifikasi teknis
- [`TOOL_CONTRACTS.md`](TOOL_CONTRACTS.md) — kontrak tool AI agent (fungsi internal Worker)
- [`apps/worker/README.md`](apps/worker/README.md) — setup Astra, KV, token, deploy Worker secara mendetail

> Folder `design-reference/` berisi materi referensi desain (mis. screenshot layout). Ada juga source code aplikasi lama (Spring Boot + MySQL) yang pernah dibuat sebagai referensi desain — **bukan** kode yang dilanjutkan/di-porting. Backend/database proyek ini dibangun dari nol.

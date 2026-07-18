# Komik Tracker

Aplikasi personal pencatat komik terbaca, dibungkus untuk Desktop (Tauri) dan Android (Capacitor), dengan fitur AI agent yang mengotomasi pencatatan dari input teks bebas.

## Status

Proyek ini masih greenfield — belum ada implementasi kode. Dokumen keputusan produk dan arsitektur sudah tersedia di root repo:

- [`PRD.md`](PRD.md) — latar belakang, tujuan produk, dan daftar fitur
- [`SPEC.md`](SPEC.md) — spesifikasi teknis
- [`TOOL_CONTRACTS.md`](TOOL_CONTRACTS.md) — kontrak tool + alur orkestrasi AI agent
- [`CLAUDE.md`](CLAUDE.md) — konteks kerja untuk Claude Code, termasuk prinsip desain yang sudah diputuskan

## Stack

- **Frontend**: React, dibungkus Tauri (desktop) & Capacitor (Android) — satu codebase
- **Backend perantara**: Cloudflare Worker
- **Orkestrasi AI**: Langflow (hosted di DataStax)
- **Model AI**: Google Gemini, API key milik masing-masing user
- **Database**: Astra DB (Cassandra-compatible)

## Catatan Penting

Ada source code aplikasi lama (Spring Boot + MySQL) di repo ini — itu hanya referensi desain, bukan kode yang dilanjutkan. Backend/database proyek ini dibangun dari nol.

Baca `CLAUDE.md` sebelum mengerjakan fitur baru.

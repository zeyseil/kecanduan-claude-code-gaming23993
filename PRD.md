# PRD — Komik Reading Tracker (nama proyek sementara)

## 1. Latar Belakang & Masalah
User membaca komik (manga/manhwa/manhua) dari berbagai sumber dan mencatat manual dalam format teks berulang, contoh (data historis nyata, 176+ entri):

```
162. Seikishi ni natta kedo danchou no oppai sugosugite kokoro ga kiyomerarenai(manga) : ch11
172.Monsters(2022)(manhwa):ch32
176.Lilia's pregnancy spells the world's end(manga):ch38(completed)
```

Pencatatan manual ini repetitif dan rawan salah ketik urutan/duplikasi. Tujuan proyek: otomasi pencatatan lewat AI agent yang menerima input teks bebas (gaya chat, bukan format ketat) dan menentukan apakah itu entry baru atau update pada komik yang sudah tercatat.

## 2. Tujuan Produk
- Halaman visual (grid card ala situs baca komik: cover, judul, badge jenis, nomor chapter terakhir, status) untuk melihat daftar bacaan
- Halaman tulis (editor teks polos, mirip area editor VS Code saja) untuk mencatat lewat teks bebas atau format lama
- AI agent memproses input teks bebas → ekstraksi info → cocokkan ke daftar existing → buat entry baru atau update chapter, dengan konfirmasi user kalau ambigu
- Data personal, terpisah per user (tidak ada daftar yang dibagikan antar user)

## 3. Non-Goals (versi ini)
- Tidak scraping/download komik dari sumber manapun
- Tidak ada daftar kolaboratif/shared antar user
- Tidak ada notifikasi otomatis rilis chapter baru dari luar (di luar apa yang user catat sendiri)

## 4. User & Skala
- Personal project, dibagikan ke lingkup kecil (User akan mengedukasi tiap orang sebelum dibagikan)
- Tiap user WAJIB mengisi API key Google AI Studio miliknya sendiri (bukan dibagi bersama)
- Platform: Desktop (Tauri), Android (Capacitor) — idealnya satu codebase frontend web yang sama

## 5. Fitur

### 5.1 Halaman Daftar Komik (visual)
Referensi tampilan: grid card seperti situs baca komik — cover, judul, badge jenis (manga/manhwa/manhua/manhwa18/dll), nomor chapter terakhir, status, indikator kapan terakhir diupdate. Ada bagian pengelompokan (mis. "terbaru diupdate" seperti bagian "Update" pada referensi).

Fitur inti:
- Sort: terbaru diupdate, alfabetis, jenis
- Filter: jenis komik, status (ongoing/completed)
- Search judul
- Klik card → detail/expand

Belum terpikirkan — perlu diputuskan:
- Perlu link ke sumber baca (URL) per komik?
- Rating/catatan pribadi per komik?
- Riwayat alias judul (nama-nama yang pernah dipakai user untuk komik yang sama) ditampilkan atau disembunyikan?

Sudah diputuskan: cover diambil otomatis lewat API publik (mis. MangaDex) saat entry dibuat/diupdate agent; kalau tidak ditemukan, fallback ke upload manual oleh user. Status 18+ ditampilkan sebagai badge terpisah dari badge jenis komik (field `is_adult` di data, bukan varian tag jenis).

### 5.2 Halaman Tulis (editor teks)
- Editor polos: font monospace, nomor baris, syntax highlight ringan khusus format (angka urut, judul, tag jenis, nomor chapter beda warna) — TANPA sidebar/tabs/file-tree ala VS Code penuh, hanya area editor-nya saja
- Mendukung bulk import format historis (baris bernomor) sekali di awal
- Mendukung input bebas/natural language untuk pemakaian harian ("baru baca X ch32")
- Tombol proses → kirim ke AI agent → hasil balik berupa daftar perubahan yang diusulkan (entry baru / update) untuk dikonfirmasi user sebelum disimpan permanen

Belum terpikirkan — perlu diputuskan:
- Perlu audit trail/log setiap proses AI (untuk bisa diperiksa ulang)?
- Perlu fitur undo hasil AI kalau ternyata salah proses?

### 5.3 AI Agent
- Input: teks bebas dari halaman tulis
- Proses: ekstraksi entitas (judul kandidat, jenis, chapter, status) → panggil tool pencocokan (fuzzy match ke daftar existing) → tool create/update
- Kalau skor kecocokan ambigu (beberapa kandidat berdekatan) → TIDAK auto-pilih, tampilkan opsi ke user untuk konfirmasi
- Tool yang dipanggil agent = endpoint aplikasi yang sudah ada sebagian (integrasi menyusul, belum diinventarisasi)

## 6. Ukuran Keberhasilan (sederhana, proyek personal)
- Tidak ada duplikat entry akibat salah cocok tanpa konfirmasi
- Waktu mencatat 1 entry baru lebih cepat dari mengetik manual format lengkap

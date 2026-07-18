# Langflow flow — Comic Tracker Agent

`comic-tracker-flow.json` adalah **scaffold best-effort**, bukan jaminan siap-import 100%. Skema JSON internal Langflow (field `template` tiap node) berubah antar versi dan saya tidak punya akses ke instance Langflow nyata untuk verifikasi langsung. Import file ini ke Langflow Anda dulu (menu **Import** di halaman flow) — kalau ada error field/komponen, opsi termudah adalah membangun ulang node yang gagal secara manual di UI Langflow memakai kode & konfigurasi di bawah ini, lalu re-connect edge sesuai graph di `LANGFLOW_FLOW.md`.

## Graph

```
Chat Input --> Agent (Google Generative AI, tool calling) --> Chat Output
                 ^  ^  ^  ^  ^
                 |  |  |  |  |
      5 Custom Component tools (tool_mode=True), masing-masing terhubung ke input "Tools" milik Agent
```

## Component ids (penting — harus sama persis dengan `apps/worker/src/routes/agent.ts`)

`agent.ts` mengirim `tweaks` per-run ke Langflow, di-target lewat id komponen berikut. Kalau Anda mengedit/membangun ulang node manual di UI dan id-nya berubah, **update `AGENT_COMPONENT_ID`/`TOOL_COMPONENT_IDS` di `agent.ts` supaya tetap sinkron**:

| Component id | Peran |
|---|---|
| `Agent-gemini` | Node Agent (Google Generative AI, tool calling) |
| `Tool-find-similar` | cari_komik_mirip |
| `Tool-create-comic` | buat_entry_baru |
| `Tool-update-chapter` | update_chapter |
| `Tool-fetch-cover` | cari_cover_mangadex |
| `Tool-log-process` | log_proses |

## Tweaks yang dikirim tiap run (dari `agent.ts`)

- `Agent-gemini` → `{ api_key: <google_api_key milik user, per-request, tidak disimpan> }`
- Tiap `Tool-*` → `{ internal_secret: <INTERNAL_TOOLS_SECRET>, user_id: "demo-user" }`

**Field `worker_base_url` pada tiap Tool component TIDAK di-tweak** (nilainya sama di semua run) — set sekali secara manual di UI Langflow ke URL publik Worker Anda (mis. `https://komik-tracker-worker.<subdomain>.workers.dev`, atau `http://localhost:8787` untuk testing lokal kalau Langflow Anda bisa menjangkau localhost Worker).

## System prompt untuk Agent (field `instructions`/`system_prompt`)

```
Kamu adalah asisten pencatat komik. User mengirim teks bebas tentang komik yang baru dibaca/diupdate.

ATURAN WAJIB (tidak boleh dilanggar):
1. SELALU panggil tool cari_komik_mirip terlebih dahulu dengan judul kandidat hasil ekstraksi dari teks user, SEBELUM memanggil tool lain apapun.
2. Kamu TIDAK PERNAH menentukan sendiri apakah ini komik baru atau update berdasarkan penilaianmu — keputusan HARUS mengikuti skor dari cari_komik_mirip:
   - Skor tertinggi >= 0.85 DAN selisih ke kandidat kedua >= 0.15 → panggil update_chapter dengan comic_id kandidat tersebut.
   - Tidak ada kandidat dengan skor >= 0.5 → panggil buat_entry_baru, lalu panggil cari_cover_mangadex dengan judul yang sama.
   - Ada 2 atau lebih kandidat dengan skor >= 0.5 dan selisih antar-skor < 0.15 (ambigu) → JANGAN panggil tool create/update apapun. Balas ke user dengan daftar kandidat dan minta mereka memilih salah satu atau konfirmasi "ini komik baru".
3. field is_adult adalah boolean terpisah — JANGAN PERNAH menggabungkannya ke dalam type_tag (mis. menjadi "manhwap" atau semacamnya). Ekstrak is_adult dari teks user sebagai true/false tersendiri.
4. type_tag hanya boleh salah satu dari: manga, manhwa, manhua.
5. SELALU panggil tool log_proses di akhir, di SEMUA cabang (created/updated/ambiguous), dengan input_text = teks asli user, ai_action sesuai cabang yang terjadi, target_comic_id (comic_id yang dibuat/diupdate, atau null kalau ambiguous), dan confirmed (true kalau langsung dieksekusi otomatis, false kalau masih menunggu user memilih pada kasus ambiguous).
6. Chapter mendukung angka desimal (mis. 11.5).

Setelah semua tool selesai, balas user dalam bahasa Indonesia singkat: apa yang terjadi (komik baru dibuat / chapter diupdate dari X ke Y / atau daftar pilihan kalau ambigu).
```

## Kode Python 5 Custom Component

Kalau import JSON gagal untuk node tertentu, buat **Custom Component** baru di Langflow UI dan tempel kode di bawah.

**Penting soal Tool Mode:** `tool_mode=True` HARUS dipasang di masing-masing `Input` yang ingin diisi oleh Agent (bukan sebagai atribut class `tool_mode = True` di level `Component` — kalau dipasang di situ, tombol Tool Mode di toolbar node malah hilang/tidak muncul di beberapa versi Langflow). Kode di bawah sudah diperbaiki: `tool_mode=True` ada di tiap input yang boleh diisi Agent (mis. `candidate_title`, `title`, `chapter`, dst) — TIDAK dipasang di `worker_base_url`/`internal_secret`/`user_id` karena tiga field itu harus tetap fixed lewat tweaks, bukan ditentukan Agent.

Setelah paste kode, cek toolbar node (tombol **"Tool Mode"** di pojok kanan atas saat node di-select) — toggle-nya harus otomatis muncul dan aktif. Baru setelah itu output **"Toolset"** bisa dihubungkan ke input "Tools" pada node Agent.

### 1. cari_komik_mirip → `Tool-find-similar`

```python
import httpx
from langflow.custom import Component
from langflow.io import StrInput, Output
from langflow.schema import Data


class FindSimilarTool(Component):
    display_name = "cari_komik_mirip"
    description = (
        "Cari komik yang mirip dengan judul kandidat. WAJIB dipanggil sebelum "
        "tool create/update lain — jangan menebak sendiri kecocokan judul."
    )
    icon = "search"

    inputs = [
        StrInput(name="candidate_title", display_name="Judul Kandidat", required=True, tool_mode=True),
        StrInput(name="worker_base_url", display_name="Worker Base URL",
                 value="http://localhost:8787", advanced=True),
        StrInput(name="internal_secret", display_name="Internal Secret", value="", advanced=True),
        StrInput(name="user_id", display_name="User Id", value="demo-user", advanced=True),
    ]
    outputs = [Output(display_name="Kandidat", name="candidates", method="run")]

    def run(self) -> Data:
        res = httpx.post(
            f"{self.worker_base_url}/internal/tools/find-similar",
            json={"candidate_title": self.candidate_title},
            headers={"X-Internal-Secret": self.internal_secret, "X-User-Id": self.user_id},
            timeout=10,
        )
        res.raise_for_status()
        return Data(data=res.json())
```

### 2. buat_entry_baru → `Tool-create-comic`

```python
import httpx
from langflow.custom import Component
from langflow.io import StrInput, BoolInput, FloatInput, Output
from langflow.schema import Data


class CreateComicTool(Component):
    display_name = "buat_entry_baru"
    description = "Buat entry komik baru. Hanya panggil kalau cari_komik_mirip tidak menemukan kecocokan (skor < 0.5)."
    icon = "plus"

    inputs = [
        StrInput(name="title", display_name="Judul", required=True, tool_mode=True),
        StrInput(name="type_tag", display_name="Jenis (manga/manhwa/manhua)", required=True, tool_mode=True),
        BoolInput(name="is_adult", display_name="Is Adult", required=True, tool_mode=True),
        FloatInput(name="chapter", display_name="Chapter", required=True, tool_mode=True),
        StrInput(name="status", display_name="Status (completed atau kosong)", value="", tool_mode=True, advanced=True),
        StrInput(name="worker_base_url", display_name="Worker Base URL",
                 value="http://localhost:8787", advanced=True),
        StrInput(name="internal_secret", display_name="Internal Secret", value="", advanced=True),
        StrInput(name="user_id", display_name="User Id", value="demo-user", advanced=True),
    ]
    outputs = [Output(display_name="Hasil", name="result", method="run")]

    def run(self) -> Data:
        res = httpx.post(
            f"{self.worker_base_url}/internal/tools/create-comic",
            json={
                "title": self.title,
                "type_tag": self.type_tag,
                "is_adult": self.is_adult,
                "chapter": self.chapter,
                "status": self.status or None,
            },
            headers={"X-Internal-Secret": self.internal_secret, "X-User-Id": self.user_id},
            timeout=10,
        )
        res.raise_for_status()
        return Data(data=res.json())
```

### 3. update_chapter → `Tool-update-chapter`

```python
import httpx
from langflow.custom import Component
from langflow.io import StrInput, FloatInput, Output
from langflow.schema import Data


class UpdateChapterTool(Component):
    display_name = "update_chapter"
    description = "Update chapter komik yang sudah ada (comic_id dari hasil cari_komik_mirip)."
    icon = "refresh-cw"

    inputs = [
        StrInput(name="comic_id", display_name="Comic Id", required=True, tool_mode=True),
        FloatInput(name="chapter", display_name="Chapter", required=True, tool_mode=True),
        StrInput(name="status", display_name="Status (completed atau kosong)", value="", tool_mode=True, advanced=True),
        StrInput(name="worker_base_url", display_name="Worker Base URL",
                 value="http://localhost:8787", advanced=True),
        StrInput(name="internal_secret", display_name="Internal Secret", value="", advanced=True),
        StrInput(name="user_id", display_name="User Id", value="demo-user", advanced=True),
    ]
    outputs = [Output(display_name="Hasil", name="result", method="run")]

    def run(self) -> Data:
        res = httpx.post(
            f"{self.worker_base_url}/internal/tools/update-chapter",
            json={"comic_id": self.comic_id, "chapter": self.chapter, "status": self.status or None},
            headers={"X-Internal-Secret": self.internal_secret, "X-User-Id": self.user_id},
            timeout=10,
        )
        res.raise_for_status()
        return Data(data=res.json())
```

### 4. cari_cover_mangadex → `Tool-fetch-cover`

```python
import httpx
from langflow.custom import Component
from langflow.io import StrInput, Output
from langflow.schema import Data


class FetchCoverTool(Component):
    display_name = "cari_cover_mangadex"
    description = "Cari cover komik dari MangaDex. Hanya panggil setelah buat_entry_baru sukses."
    icon = "image"

    inputs = [
        StrInput(name="title", display_name="Judul", required=True, tool_mode=True),
        StrInput(name="worker_base_url", display_name="Worker Base URL",
                 value="http://localhost:8787", advanced=True),
        StrInput(name="internal_secret", display_name="Internal Secret", value="", advanced=True),
        StrInput(name="user_id", display_name="User Id", value="demo-user", advanced=True),
    ]
    outputs = [Output(display_name="Hasil", name="result", method="run")]

    def run(self) -> Data:
        res = httpx.post(
            f"{self.worker_base_url}/internal/tools/fetch-cover",
            json={"title": self.title},
            headers={"X-Internal-Secret": self.internal_secret, "X-User-Id": self.user_id},
            timeout=10,
        )
        res.raise_for_status()
        return Data(data=res.json())
```

### 5. log_proses → `Tool-log-process`

```python
import httpx
from langflow.custom import Component
from langflow.io import StrInput, BoolInput, Output
from langflow.schema import Data


class LogProcessTool(Component):
    display_name = "log_proses"
    description = "WAJIB dipanggil di akhir, di SETIAP cabang (created/updated/ambiguous) — audit trail."
    icon = "file-text"

    inputs = [
        StrInput(name="input_text", display_name="Teks Input Asli", required=True, tool_mode=True),
        StrInput(name="ai_action", display_name="Aksi (created/updated/ambiguous)", required=True, tool_mode=True),
        StrInput(name="target_comic_id", display_name="Target Comic Id (kosong kalau ambiguous)",
                  value="", tool_mode=True, advanced=True),
        BoolInput(name="confirmed", display_name="Confirmed", required=True, tool_mode=True),
        StrInput(name="worker_base_url", display_name="Worker Base URL",
                 value="http://localhost:8787", advanced=True),
        StrInput(name="internal_secret", display_name="Internal Secret", value="", advanced=True),
        StrInput(name="user_id", display_name="User Id", value="demo-user", advanced=True),
    ]
    outputs = [Output(display_name="Hasil", name="result", method="run")]

    def run(self) -> Data:
        res = httpx.post(
            f"{self.worker_base_url}/internal/tools/log-process",
            json={
                "input_text": self.input_text,
                "ai_action": self.ai_action,
                "target_comic_id": self.target_comic_id or None,
                "confirmed": self.confirmed,
            },
            headers={"X-Internal-Secret": self.internal_secret, "X-User-Id": self.user_id},
            timeout=10,
        )
        res.raise_for_status()
        return Data(data=res.json())
```

## Verifikasi setelah import

1. Buka flow di Langflow UI, cek graph: Chat Input → Agent → Chat Output, dan 5 Tool node terhubung ke input "Tools" milik Agent.
2. Isi field `worker_base_url` di kelima Tool node (default `http://localhost:8787`, ganti kalau Worker Anda di URL lain).
3. Salin `id` flow dari URL Langflow (`.../flow/<flow-id>`), pasang ke `LANGFLOW_API_URL` di `.dev.vars` sebagai `https://<langflow-host>/api/v1/run/<flow-id>`.
4. Test langsung di UI Langflow (Playground) dulu dengan input teks contoh, sebelum test lewat `/agent/process` di Worker.

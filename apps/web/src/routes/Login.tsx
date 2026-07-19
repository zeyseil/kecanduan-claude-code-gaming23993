import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken } from "../lib/storage";
import { clearComicCache } from "../lib/comicCache";
import { AppLogo } from "../components/AppLogo";

/**
 * Latar panel kiri: tiruan grid Daftar Komik yang diburamkan.
 *
 * Sengaja murni CSS (tidak memakai ComicCard atau data nyata) — halaman login
 * belum terautentikasi, jadi tidak boleh ada request maupun aset eksternal.
 */
function DashboardPreview() {
  const cards = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div aria-hidden="true" className="grid grid-cols-4 gap-4 p-8">
      {cards.map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div
            className={[
              "aspect-[3/4] rounded-lg bg-gradient-to-br shadow-lg",
              i % 3 === 0
                ? "from-indigo-500/70 to-slate-800"
                : i % 3 === 1
                  ? "from-slate-600 to-slate-900"
                  : "from-sky-500/50 to-slate-800",
            ].join(" ")}
          />
          <div className="h-2 w-3/4 rounded bg-slate-600" />
          <div className="h-2 w-1/2 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() === "") return;
    // Token baru bisa milik user berbeda — buang cache komik user sebelumnya.
    clearComicCache();
    setAuthToken(token.trim());
    navigate("/", { replace: true });
  };

  return (
    <div className="grid min-h-screen bg-slate-950 text-slate-100 lg:grid-cols-2">
      {/* Panel kiri — branding. Disembunyikan di bawah lg (mobile-first). */}
      <div className="relative hidden overflow-hidden border-r border-slate-800 lg:block">
        <div className="absolute inset-0 scale-110 blur-[6px]">
          <DashboardPreview />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/70 to-indigo-950/70" />

        <div className="relative flex h-full flex-col items-center justify-center gap-4 px-12 text-center">
          <div className="flex items-center gap-4">
            <AppLogo className="h-16 w-16 shadow-lg" />
            <h1 className="text-5xl font-bold tracking-tight text-white">
              Komik Tracker
            </h1>
          </div>
          <p className="text-lg text-slate-300">
            Temukan dan Lacak Komik Favorit Anda.
          </p>
        </div>
      </div>

      {/* Panel kanan — form login. */}
      <div className="flex flex-col">
        <header className="flex items-center gap-2 border-b border-slate-800 px-6 py-4">
          <AppLogo className="h-6 w-6" />
          <span className="text-base font-bold text-indigo-400">Komik Tracker</span>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <h2 className="mb-1 text-2xl font-bold text-white">Login</h2>
            <p className="mb-6 text-sm text-slate-400">
              Masukkan token yang dibagikan ke Anda. Token tidak divalidasi di sini — kalau
              salah, request pertama ke server akan gagal dan Anda diminta login ulang.
            </p>

            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"
            >
              <label
                htmlFor="auth-token"
                className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
              >
                Token
              </label>
              <input
                id="auth-token"
                type="password"
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="token dari admin"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Masuk
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              aplikasi belum dipublikkan jadi mau login harus minta admin
            </p>
          </div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-slate-500">
          © 2026 Komik Tracker.
        </footer>
      </div>
    </div>
  );
}

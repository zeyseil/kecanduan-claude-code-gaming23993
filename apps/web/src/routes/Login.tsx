import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken } from "../lib/storage";

export function Login() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() === "") return;
    setAuthToken(token.trim());
    navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-lg font-semibold text-slate-100">Login</h1>
      <p className="mb-4 text-sm text-slate-400">
        Masukkan token yang dibagikan ke Anda. Token tidak divalidasi di sini — kalau salah,
        request pertama ke server akan gagal dan Anda diminta login ulang.
      </p>

      <form onSubmit={handleSubmit} className="rounded-md border border-slate-700 bg-slate-800 p-3">
        <label htmlFor="auth-token" className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
          Token
        </label>
        <input
          id="auth-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="token dari admin"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-3 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Masuk
        </button>
      </form>
    </div>
  );
}

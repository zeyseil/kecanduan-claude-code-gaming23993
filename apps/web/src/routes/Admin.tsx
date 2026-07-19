import { useEffect, useState } from "react";
import {
  createToken,
  fetchAdminHealth,
  fetchAdminLogs,
  fetchAdminUsers,
  revokeUserAccess,
  type AdminHealth,
  type AdminLog,
  type AdminUser,
} from "../lib/api/admin";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function Admin() {
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Token creation
  const [newUserId, setNewUserId] = useState("");
  const [creating, setCreating] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{ token: string; user_id: string } | null>(null);

  // Revocation confirm (two-step)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  async function loadAll() {
    setError(null);
    try {
      const [h, u, l] = await Promise.all([fetchAdminHealth(), fetchAdminUsers(), fetchAdminLogs()]);
      setHealth(h);
      setUsers(u.users);
      setLogs(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newUserId.trim() === "") return;
    setCreating(true);
    setError(null);
    try {
      const result = await createToken(newUserId.trim());
      setIssuedToken(result);
      setNewUserId("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(userId: string) {
    setError(null);
    try {
      await revokeUserAccess(userId);
      setConfirmRevoke(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const totalComics = users.reduce((sum, u) => sum + u.comic_count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Dashboard Admin</h1>
        <p className="text-sm text-slate-400">Hanya terlihat untuk token dengan role admin.</p>
      </div>

      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">Batasan fitur ini:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            Role <strong>admin</strong> hanya bisa diberikan lewat <code>wrangler</code> di desktop,
            tidak pernah dari halaman ini.
          </li>
          <li>
            Token baru <strong>hanya ditampilkan sekali</strong> saat dibuat — salin segera, tidak
            bisa dilihat lagi setelah itu.
          </li>
          <li>Daftar user memakai KV yang eventually-consistent — perubahan bisa telat beberapa detik.</li>
          <li>
            Data user lain <strong>hanya metadata</strong> (jumlah komik &amp; aktivitas terakhir) —
            judul komik dan isi teks mereka tidak ditampilkan.
          </li>
          <li>Kesehatan sistem adalah potret saat halaman dibuka, bukan monitoring berkelanjutan.</li>
        </ul>
      </div>

      {error && (
        <div className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">
          {error}
          <button onClick={() => void loadAll()} className="ml-2 underline">
            Coba lagi
          </button>
        </div>
      )}

      <Section title="Kesehatan sistem">
        {!health ? (
          <p className="text-sm text-slate-400">Memuat…</p>
        ) : (
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              Astra DB:{" "}
              <span className={health.astra === "ok" ? "text-emerald-400" : "text-rose-400"}>
                {health.astra === "ok" ? "sehat" : "tidak terjangkau"}
              </span>
              {health.astra_detail && <span className="block text-xs text-rose-300">{health.astra_detail}</span>}
            </div>
            <div>Model Gemini default: <code>{health.gemini_model}</code></div>
            <div>
              Binding: AUTH_TOKENS {health.bindings.auth_tokens ? "✓" : "✗"}, RATE_LIMITER{" "}
              {health.bindings.rate_limiter ? "✓" : "✗"}, USER_RATE_LIMITER{" "}
              {health.bindings.user_rate_limiter ? "✓" : "✗"}
            </div>
            {health.activity_24h && (
              <div>
                Aktivitas AI 24 jam: {health.activity_24h.total} total ({health.activity_24h.byAction.created}{" "}
                dibuat, {health.activity_24h.byAction.updated} diupdate, {health.activity_24h.byAction.ambiguous}{" "}
                ambigu)
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="User & Token">
        <form onSubmit={handleCreate} className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="new-user-id" className="mb-1 block text-xs text-slate-400">
              user_id untuk token baru
            </label>
            <input
              id="new-user-id"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="mis. teman-budi"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? "Membuat…" : "Buat token"}
          </button>
        </form>

        {issuedToken && (
          <div className="mb-3 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-100">
            <p className="mb-1 font-medium">
              Token untuk <code>{issuedToken.user_id}</code> — salin sekarang, tidak bisa dilihat lagi:
            </p>
            <code className="block break-all rounded bg-slate-950 px-2 py-1 text-amber-300">
              {issuedToken.token}
            </code>
            <button onClick={() => setIssuedToken(null)} className="mt-2 text-xs underline">
              Sudah saya salin, tutup
            </button>
          </div>
        )}

        {users.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada token.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Token</th>
                  <th className="py-1 pr-3">user_id</th>
                  <th className="py-1 pr-3">Role</th>
                  <th className="py-1 pr-3">Komik</th>
                  <th className="py-1 pr-3">Aktivitas terakhir</th>
                  <th className="py-1">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.token_masked} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3"><code>{u.token_masked}</code></td>
                    <td className="py-1.5 pr-3">{u.user_id}</td>
                    <td className="py-1.5 pr-3">
                      {u.role === "admin" ? (
                        <span className="text-indigo-400">admin</span>
                      ) : (
                        "user"
                      )}
                    </td>
                    <td className="py-1.5 pr-3">{u.comic_count}</td>
                    <td className="py-1.5 pr-3">{formatWhen(u.last_activity)}</td>
                    <td className="py-1.5">
                      {u.role === "admin" ? (
                        <span className="text-xs text-slate-500">(lewat wrangler)</span>
                      ) : confirmRevoke === u.user_id ? (
                        <span className="flex gap-2">
                          <button
                            onClick={() => void handleRevoke(u.user_id)}
                            className="rounded bg-rose-600 px-2 py-0.5 text-xs text-white hover:bg-rose-500"
                          >
                            Ya, cabut
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(null)}
                            className="rounded bg-slate-700 px-2 py-0.5 text-xs text-white"
                          >
                            Batal
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmRevoke(u.user_id)}
                          className="rounded border border-rose-800 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-950/40"
                        >
                          Cabut akses
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Aktivitas AI (milik sendiri)">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada aktivitas.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-slate-300">
            {logs.map((log, i) => (
              <li key={i} className="border-t border-slate-800 py-1 first:border-0">
                <span className="text-xs text-slate-500">{formatWhen(log.ts)}</span> — {log.ai_action}
                {": "}
                <span className="text-slate-400">{log.input_text}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Statistik konten">
        <div className="text-sm text-slate-300">
          <p>Total user (token): {users.length}</p>
          <p>Total komik (semua user): {totalComics}</p>
        </div>
      </Section>
    </div>
  );
}

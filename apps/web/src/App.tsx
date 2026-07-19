import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { DaftarKomik } from "./routes/DaftarKomik";
import { Tulis } from "./routes/Tulis";
import { Login } from "./routes/Login";
import { Admin } from "./routes/Admin";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import { AppLogo } from "./components/AppLogo";
import { getAuthToken } from "./lib/storage";
import { fetchAdminHealth } from "./lib/api/admin";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-indigo-600 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white",
  ].join(" ");

export function App() {
  // Probe admin status once so the "Admin" nav link only appears for admins.
  // A non-admin gets 403 (caught → stays hidden); no token → not probed.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!getAuthToken()) return;
    let alive = true;
    fetchAdminHealth()
      .then(() => alive && setIsAdmin(true))
      .catch(() => {
        /* not an admin, or offline — link stays hidden */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Routes>
      {/* Login berdiri sendiri (split-screen full-page), di luar shell aplikasi. */}
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Shell isAdmin={isAdmin} />} />
    </Routes>
  );
}

function Shell({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <AppLogo className="h-7 w-7" />
          <span className="text-base font-bold text-indigo-400">
            Komik Tracker
          </span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              Daftar
            </NavLink>
            <NavLink to="/tulis" className={navClass}>
              Tulis
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <DaftarKomik />
              </RequireAuth>
            }
          />
          <Route
            path="/tulis"
            element={
              <RequireAuth>
                <Tulis />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

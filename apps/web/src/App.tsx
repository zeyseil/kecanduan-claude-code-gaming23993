import { NavLink, Route, Routes } from "react-router-dom";
import { DaftarKomik } from "./routes/DaftarKomik";
import { Tulis } from "./routes/Tulis";
import { Login } from "./routes/Login";
import { RequireAuth } from "./components/RequireAuth";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-indigo-600 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white",
  ].join(" ");

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Routes>
          <Route path="/login" element={<Login />} />
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
        </Routes>
      </main>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../lib/storage";
import { fetchAdminHealth } from "../lib/api/admin";

// The real gate is the Worker (requireAdmin middleware). This guard only spares
// a non-admin from seeing an error page: it probes /admin/health once and, on
// any failure (403 for non-admins, or no token), sends them back home.
type State = "checking" | "ok" | "denied";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (!getAuthToken()) {
      setState("denied");
      return;
    }
    let alive = true;
    fetchAdminHealth()
      .then(() => alive && setState("ok"))
      .catch(() => alive && setState("denied"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return <p className="text-sm text-slate-400">Memeriksa akses…</p>;
  }
  if (state === "denied") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

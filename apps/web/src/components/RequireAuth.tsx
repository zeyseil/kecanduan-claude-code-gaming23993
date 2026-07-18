import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../lib/storage";

export function RequireAuth({ children }: { children: ReactNode }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

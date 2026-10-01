import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { ReactNode } from "react";

/** Bloque l’URL directe si le rôle n’est pas autorisé (D4). */
export function RoleRoute({
  allow,
  children,
}: {
  allow: string[];
  children: ReactNode;
}) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

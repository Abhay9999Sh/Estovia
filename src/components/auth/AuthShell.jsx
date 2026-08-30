"use client";

import { AuthProvider } from "@/context/AuthContext";

export default function AuthShell({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

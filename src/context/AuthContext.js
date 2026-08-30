"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (identifier, password) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    },
    []
  );

  const register = useCallback(
    async (payload) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // ignore
    }
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const setUserData = useCallback((next) => {
    setUser(next);
  }, []);

  const isLoggedIn = status === "authenticated";
  const hasRole = useCallback(
    (role) => {
      if (!user || !Array.isArray(user.roles)) return false;
      if (Array.isArray(role)) return role.some((r) => user.roles.includes(r));
      return user.roles.includes(role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, status, isLoggedIn, login, register, logout, refresh, setUserData, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

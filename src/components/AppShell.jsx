"use client";

import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </AuthProvider>
  );
}

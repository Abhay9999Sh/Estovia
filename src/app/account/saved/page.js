"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";

export default function SavedPage() {
  return (
    <AppShell>
      <SavedContent />
    </AppShell>
  );
}

function SavedContent() {
  const { isLoggedIn } = useAuth();
  return (
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Saved</h1>
        <p className="mt-2 text-muted">
          Properties and land you have bookmarked for later.
        </p>

        {!isLoggedIn ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <p className="text-muted">Please log in to view your saved items.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Log In
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Bookmark className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No saved items</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Save listings you&apos;re interested in to find them here later.
            </p>
            <Link
              href="/explore"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Explore Listings
            </Link>
          </div>
        )}
      </div>
  );
}
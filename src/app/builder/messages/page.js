"use client";

import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import MessagesInbox from "@/components/messages/MessagesInbox";

function Inner() {
  return (
    <BuilderDashboardShell title="Messages">
      <MessagesInbox />
    </BuilderDashboardShell>
  );
}

export default function BuilderMessagesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Messages"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
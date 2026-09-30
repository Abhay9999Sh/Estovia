"use client";

import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import MessagesInbox from "@/components/messages/MessagesInbox";

function Inner() {
  return (
    <DashboardShell title="Messages">
      <MessagesInbox />
    </DashboardShell>
  );
}

export default function LandownerMessagesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<DashboardShell title="Messages"><div /></DashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
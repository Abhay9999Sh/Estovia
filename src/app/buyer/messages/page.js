"use client";

import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import MessagesInbox from "@/components/messages/MessagesInbox";

function Inner() {
  return (
    <BuyerDashboardShell title="Messages">
      <MessagesInbox />
    </BuyerDashboardShell>
  );
}

export default function BuyerMessagesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuyerDashboardShell title="Messages"><div /></BuyerDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
"use client";

import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import MessagesInbox from "@/components/messages/MessagesInbox";

function Inner() {
  return (
    <SupplierDashboardShell title="Messages">
      <MessagesInbox />
    </SupplierDashboardShell>
  );
}

export default function SupplierMessagesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<SupplierDashboardShell title="Messages"><div /></SupplierDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
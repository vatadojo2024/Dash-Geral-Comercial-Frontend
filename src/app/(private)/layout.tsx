import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/features/session/SessionProvider";
import { getServerSession } from "@/lib/auth/session";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <SessionProvider user={user}>
      <AppShell user={user}>{children}</AppShell>
    </SessionProvider>
  );
}

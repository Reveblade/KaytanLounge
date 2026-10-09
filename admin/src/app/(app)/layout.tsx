import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { AdminSessionProvider } from "@/lib/session/context";
import { currentAdmin } from "@/lib/session/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentAdmin();
  if (!session) redirect("/login");
  const theme = (await cookies()).get("biy_admin_theme")?.value === "dark" ? "dark" : "light";
  return (
    <AdminSessionProvider admin={session.admin} permissions={session.permissions}>
      <AppShell initialTheme={theme}>{children}</AppShell>
    </AdminSessionProvider>
  );
}

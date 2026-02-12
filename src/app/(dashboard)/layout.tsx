import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { ClientOnly } from "@/components/ClientWrapper";
import { TabProvider } from "@/components/TabContext";

// Force dynamic rendering to check auth on every request
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("site_auth");

  if (!authCookie || authCookie.value !== "1") {
    redirect("/login/");
  }

  return (
    <TabProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-white">
        {/* Header bar */}
        <ClientOnly>
          <Header />
        </ClientOnly>
        {/* Main content */}
        {children}
      </div>
    </TabProvider>
  );
}

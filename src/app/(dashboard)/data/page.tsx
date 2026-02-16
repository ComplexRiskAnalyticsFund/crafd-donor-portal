import { UnifiedDashboard } from "@/components/UnifiedDashboard";
import { ClientOnly } from "@/components/ClientWrapper";

export default function ProjectsPage() {
  return (
    <main className="min-h-0 flex-1">
      <ClientOnly>
        <UnifiedDashboard />
      </ClientOnly>
    </main>
  );
}

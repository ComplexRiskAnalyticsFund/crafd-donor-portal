import { ClientOnly } from "@/components/ClientWrapper";

export default function PartnersPage() {
  return (
    <main className="min-h-0 flex-1">
      <ClientOnly>
        <div className="flex h-full flex-col">
          {/* Partner Organizations Content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <iframe
              src={process.env.NEXT_PUBLIC_AIRTABLE_PARTNERS_URL || ""}
              className="h-full w-full border-none"
              title="Partner Organizations"
              allow="accelerometer; camera; microphone; gyroscope"
            />
          </div>
        </div>
      </ClientOnly>
    </main>
  );
}

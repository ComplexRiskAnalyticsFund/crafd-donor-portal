"use client";

import { ClientOnly } from "@/components/ClientWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  Clock,
  Users,
  FileText,
  CheckCircle2,
} from "lucide-react";

// Placeholder data for meeting
const MEETING_INFO = {
  date: "March 15, 2026",
  time: "14:00 - 16:00 UTC",
  location: "Virtual (Zoom)",
  attendees: 12,
};

const AGENDA_ITEMS = [
  {
    id: 1,
    time: "14:00 - 14:10",
    title: "Welcome & Opening Remarks",
    presenter: "Chair",
    duration: "10 min",
    status: "pending" as const,
  },
  {
    id: 2,
    time: "14:10 - 14:30",
    title: "Review of Previous Action Items",
    presenter: "Secretariat",
    duration: "20 min",
    status: "pending" as const,
  },
  {
    id: 3,
    time: "14:30 - 15:00",
    title: "Q1 2026 Project Portfolio Update",
    presenter: "Program Director",
    duration: "30 min",
    status: "pending" as const,
  },
  {
    id: 4,
    time: "15:00 - 15:30",
    title: "New Funding Proposals Review",
    presenter: "Finance Committee",
    duration: "30 min",
    status: "pending" as const,
  },
  {
    id: 5,
    time: "15:30 - 15:50",
    title: "Risk Assessment & Mitigation Strategies",
    presenter: "Risk Analyst",
    duration: "20 min",
    status: "pending" as const,
  },
  {
    id: 6,
    time: "15:50 - 16:00",
    title: "AOB & Closing",
    presenter: "Chair",
    duration: "10 min",
    status: "pending" as const,
  },
];

const DOCUMENTS = [
  { id: 1, name: "Meeting Agenda", type: "PDF" },
  { id: 2, name: "Q1 2026 Report", type: "PDF" },
  { id: 3, name: "Funding Proposals Summary", type: "XLSX" },
  { id: 4, name: "Risk Assessment Matrix", type: "PDF" },
];

export default function SteerCoMeetingPage() {
  return (
    <main className="min-h-0 flex-1 overflow-auto bg-gray-50">
      <ClientOnly>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-black">
              Upcoming SteerCo Meeting
            </h1>
            <p className="text-gray-600">
              Steering Committee Meeting - March 2026
            </p>
          </div>

          {/* Meeting Info Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <div className="rounded-full bg-crafd-yellow/20 p-3">
                  <CalendarDays className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold text-black">
                    {MEETING_INFO.date}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <div className="rounded-full bg-crafd-yellow/20 p-3">
                  <Clock className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold text-black">
                    {MEETING_INFO.time}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <div className="rounded-full bg-crafd-yellow/20 p-3">
                  <Users className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Attendees</p>
                  <p className="font-semibold text-black">
                    {MEETING_INFO.attendees} Expected
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <div className="rounded-full bg-crafd-yellow/20 p-3">
                  <FileText className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Documents</p>
                  <p className="font-semibold text-black">
                    {DOCUMENTS.length} Attached
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Agenda Timeline */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-crafd-yellow" />
                  Meeting Agenda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {AGENDA_ITEMS.map((item, index) => (
                    <div
                      key={item.id}
                      className="relative flex gap-4 pb-4 last:pb-0"
                    >
                      {/* Timeline Line */}
                      {index !== AGENDA_ITEMS.length - 1 && (
                        <div className="absolute top-8 left-3.75 h-full w-0.5 bg-gray-200" />
                      )}

                      {/* Timeline Dot */}
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-crafd-yellow bg-white">
                        <div className="h-2 w-2 rounded-full bg-crafd-yellow" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1 pt-0.5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-black">
                              {item.title}
                            </p>
                            <p className="text-sm text-gray-600">
                              {item.presenter} • {item.duration}
                            </p>
                          </div>
                          <span className="text-sm font-medium whitespace-nowrap text-crafd-yellow">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Meeting Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-crafd-yellow" />
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {DOCUMENTS.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded bg-crafd-yellow/20 px-2 py-1">
                            <span className="text-xs font-semibold text-black">
                              {doc.type}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-black">
                            {doc.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-crafd-yellow" />
                    Pre-Meeting Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Review Q1 Report
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Submit feedback on proposals
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-gray-300" />
                      <span className="text-sm text-gray-700">
                        Prepare questions for discussion
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ClientOnly>
    </main>
  );
}

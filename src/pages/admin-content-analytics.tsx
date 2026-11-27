import { ContentPerformancePanel } from "@/components/content-performance";

export default function AdminContentAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Watch hours, viewers, and credited revenue for every creator title. Use this list to decide which films and series to keep. Removed titles stay on the ledger and appear greyed out.
        </p>
      </div>
      <ContentPerformancePanel scope="admin-all" heading="" />
    </div>
  );
}

import { useLocation } from "wouter";
import { Clapperboard, Eye, Film, HardDrive, Library, Loader2, Tv, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, fmtDateTime, useCreatorDashboard } from "@/lib/creator-api";

const STATUS_ORDER = ["draft", "processing", "moderation", "rejected", "published"] as const;
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  moderation: "In Review",
  rejected: "Rejected",
  published: "Published",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-zinc-500/15 text-foreground/80",
  processing: "bg-sky-500/15 text-sky-400",
  moderation: "bg-amber-500/15 text-amber-400",
  rejected: "bg-rose-500/15 text-rose-400",
  published: "bg-emerald-500/15 text-emerald-400",
};

const emptyCounts = { draft: 0, processing: 0, moderation: 0, rejected: 0, published: 0, total: 0 };

export default function CreatorDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, error } = useCreatorDashboard();
  const summary = data?.data;
  const movies = { ...emptyCounts, ...(summary?.counts?.movies || {}) };
  const shows = { ...emptyCounts, ...(summary?.counts?.tvShows || {}) };
  const quotas = summary?.quotas;
  const pendingRatio = quotas?.maxPendingSubmissions
    ? Math.min(100, Math.round((Number(quotas.currentPendingSubmissions || 0) / Number(quotas.maxPendingSubmissions)) * 100))
    : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-semibold">Creator dashboard is unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message || "Try again in a moment."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500 inline-flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5" /> Creator console
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-1">Your films</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload movies and web series, then submit them for review. Published titles appear on Ashqe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setLocation("/movies/new")} className="gap-2">
            <Upload className="w-4 h-4" /> Upload Movie
          </Button>
          <Button variant="outline" onClick={() => setLocation("/tv-shows/new")} className="gap-2">
            <Tv className="w-4 h-4" /> Upload Web Series
          </Button>
          <Button variant="outline" onClick={() => setLocation("/media-library")} className="gap-2">
            <Library className="w-4 h-4" /> Media Library
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Film} label="Movies" value={movies.total} hint={`${movies.published} published`} />
        <Stat icon={Tv} label="Web series" value={shows.total} hint={`${shows.published} published`} />
        <Stat icon={Eye} label="Total views" value={Number(summary?.totalViews || 0).toLocaleString()} hint="On published content" />
        <Stat
          icon={HardDrive}
          label="Upload limit"
          value={formatBytes(quotas?.maxUploadSizeBytes)}
          hint={`${quotas?.currentPendingSubmissions ?? 0} of ${quotas?.maxPendingSubmissions ?? "—"} in review`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Breakdown title="Movies" counts={movies} onOpen={() => setLocation("/movies")} />
        <Breakdown title="Web series" counts={shows} onOpen={() => setLocation("/tv-shows")} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Titles waiting on an editor</span>
            <span className="font-semibold">{quotas?.currentPendingSubmissions ?? 0} / {quotas?.maxPendingSubmissions ?? "—"}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${pendingRatio}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Each file can be up to {formatBytes(quotas?.maxUploadSizeBytes)}. Video uploads go directly to storage, then process into HLS before you can submit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(summary?.recentSubmissions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No submissions yet. Upload a movie or web series to get started.</p>
          ) : (summary.recentSubmissions || []).map((item: any) => {
            const status = item.status || "draft";
            const rawType = String(item.type || item.kind || "movie");
            const isWebSeries = rawType === "tv" || rawType === "tvShow" || rawType === "webseries";
            const href = isWebSeries
              ? `/tv-shows/${item.id || item._id}/edit`
              : `/movies/${item.id || item._id}/edit`;
            const typeLabel = isWebSeries ? "web series" : rawType === "movie" ? "movie" : rawType.replace("webseries", "web series");
            return (
              <button
                key={item.id || item._id || item.title}
                type="button"
                onClick={() => item.id || item._id ? setLocation(href) : undefined}
                className="w-full text-left rounded-xl border border-border px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{item.title || item.name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {typeLabel}
                      {item.updatedAt || item.submittedAt ? ` · ${fmtDateTime(item.updatedAt || item.submittedAt)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_TONE[status] || STATUS_TONE.draft}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </div>
                {status === "rejected" && item.rejectionReason && (
                  <p className="mt-2 text-sm text-rose-400">Rejected: {item.rejectionReason}</p>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: any; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-2xl font-black mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function Breakdown({ title, counts, onOpen }: { title: string; counts: typeof emptyCounts; onOpen: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onOpen}>Open</Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STATUS_ORDER.map((key) => (
          <div key={key} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[key]}</p>
            <p className="text-lg font-bold">{counts[key] ?? 0}</p>
          </div>
        ))}
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{counts.total ?? 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}

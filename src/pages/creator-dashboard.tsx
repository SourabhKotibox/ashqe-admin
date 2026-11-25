import type { ComponentType } from "react";
import { useLocation } from "wouter";
import { Clapperboard, Clock, Film, HardDrive, IndianRupee, Library, Tv, Upload } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, fmtDateTime, useCreatorDashboard } from "@/lib/creator-api";
import { getImageUrl, useGetMe } from "@/lib/api-client";
import { influencerMayOpenPath } from "@/lib/creator-access";
import { formatInr, formatRate, formatWatchHours, useCreatorRevenueSeries, useCreatorRevenueSummary } from "@/lib/creator-revenue";
import { QueryState } from "@/components/creator-revenue-ui";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  moderation: "In review",
  rejected: "Rejected",
  published: "Published",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-zinc-500/15 text-foreground/80",
  processing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  moderation: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const emptyCounts = { draft: 0, processing: 0, moderation: 0, rejected: 0, published: 0, total: 0 };
const last30 = { period: "30d" as const, from: "", to: "" };

function initials(name?: string) {
  const parts = String(name || "Creator").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "C";
}

export default function CreatorDashboard() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();
  const sections = Array.isArray(me?.sections) ? me.sections as string[] : undefined;
  const canOpen = (href: string) => influencerMayOpenPath(href, sections);
  const dash = useCreatorDashboard();
  const earnings = useCreatorRevenueSummary(last30);
  const series = useCreatorRevenueSeries(last30);
  const summary = dash.data?.data;
  const movies = { ...emptyCounts, ...(summary?.counts?.movies || {}) };
  const shows = { ...emptyCounts, ...(summary?.counts?.tvShows || {}) };
  const published = (movies.published || 0) + (shows.published || 0);
  const inReview = (movies.moderation || 0) + (movies.processing || 0) + (shows.moderation || 0) + (shows.processing || 0);
  const drafts = (movies.draft || 0) + (shows.draft || 0);
  const titleTotal = (movies.total || 0) + (shows.total || 0);
  const points = series.data?.data?.points || [];
  const rate = earnings.data?.data?.rate;
  const avatar = me?.avatar ? getImageUrl(me.avatar) : "";

  if (dash.isLoading || meLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (dash.isError) {
    return (
      <QueryState isError error={dash.error} onRetry={() => dash.refetch()} />
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-amber-500/10 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-background ring-offset-2 ring-offset-primary/50">
              {avatar ? <AvatarImage src={avatar} alt="" /> : null}
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials(me?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Clapperboard className="h-3.5 w-3.5" /> Creator
              </p>
              <h1 className="truncate text-2xl font-bold text-foreground">Welcome back, {me?.name || "Creator"}</h1>
              <p className="text-sm text-muted-foreground">Your films, watch time, and earnings from the last 30 days.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canOpen("/movies") && (
              <Button onClick={() => setLocation("/movies/new")} className="gap-2">
                <Upload className="h-4 w-4" /> Upload movie
              </Button>
            )}
            {canOpen("/tv-shows") && (
              <Button variant="outline" onClick={() => setLocation("/tv-shows/new")} className="gap-2">
                <Tv className="h-4 w-4" /> Create series
              </Button>
            )}
            <Button variant="outline" onClick={() => setLocation("/earnings")} className="gap-2">
              <IndianRupee className="h-4 w-4" /> View revenue
            </Button>
            {canOpen("/media-library") && (
              <Button variant="outline" onClick={() => setLocation("/media-library")} className="gap-2">
                <Library className="h-4 w-4" /> Media
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label="Earnings"
          value={earnings.isLoading ? "…" : formatInr(earnings.data?.data?.amountInr || 0)}
          hint="Last 30 days"
          icon={IndianRupee}
        />
        <Kpi
          label="Watch hours"
          value={earnings.isLoading ? "…" : formatWatchHours(earnings.data?.data?.watchHours || 0)}
          hint="Last 30 days"
          icon={Clock}
        />
        <Kpi
          label="Current rate"
          value={earnings.isLoading ? "…" : formatRate(rate?.rateInrPerHour || 0)}
          hint={rate?.source === "override" ? "Your override" : "Global default"}
          icon={IndianRupee}
        />
        <Kpi label="Published" value={String(published)} hint="Movies and series live on Ashqe" icon={Film} />
        <Kpi label="In review" value={String(inReview)} hint="Processing or waiting on an editor" icon={Clapperboard} />
        <Kpi label="Drafts" value={String(drafts)} hint="Not submitted yet" icon={HardDrive} />
      </div>

      {earnings.isError && (
        <QueryState isError error={earnings.error} onRetry={() => earnings.refetch()} />
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Earnings, last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {series.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : points.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No watch time credited in the last 30 days.</p>
            ) : (
              <div className="h-28" aria-label="Earnings sparkline for the last 30 days">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points}>
                    <Area type="monotone" dataKey="amountInr" stroke="#d97706" fill="#d97706" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {formatInr(earnings.data?.data?.amountInr || 0)} from {formatWatchHours(earnings.data?.data?.watchHours || 0)} of watch time.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent titles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {titleTotal === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <p className="font-semibold">No titles yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Upload a movie or start a series. Earnings begin after a title is published and someone watches it.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {canOpen("/movies") && <Button onClick={() => setLocation("/movies/new")}>Upload movie</Button>}
                  {canOpen("/tv-shows") && <Button variant="outline" onClick={() => setLocation("/tv-shows/new")}>Create series</Button>}
                </div>
              </div>
            ) : (summary?.recentSubmissions || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent submissions.</p>
            ) : (summary.recentSubmissions || []).map((item: any) => {
              const status = item.status || "draft";
              const isSeries = item.type === "tv" || item.type === "tvShow" || item.type === "webseries";
              const href = isSeries ? `/tv-shows/${item.id}/edit` : `/movies/${item.id}/edit`;
              return (
                <button
                  key={item.id || item.title}
                  type="button"
                  onClick={() => item.id && setLocation(href)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isSeries ? "Series" : "Movie"}
                      {item.updatedAt ? ` · ${fmtDateTime(item.updatedAt)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] || STATUS_TONE.draft}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["/languages", "Languages"],
          ["/genres", "Genres"],
          ["/actors", "Actors"],
          ["/directors", "Directors"],
          ["/crew", "Crew"],
          ["/countries", "Countries"],
        ] as const).filter(([href]) => canOpen(href)).map(([href, label]) => (
          <Button key={href} variant="outline" size="sm" onClick={() => setLocation(href)}>{label}</Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Titles waiting on an editor</span>
            <span className="font-semibold">{summary?.quotas?.currentPendingSubmissions ?? 0} / {summary?.quotas?.maxPendingSubmissions ?? "—"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-amber-500"
              style={{
                width: `${summary?.quotas?.maxPendingSubmissions
                  ? Math.min(100, Math.round((Number(summary.quotas.currentPendingSubmissions || 0) / Number(summary.quotas.maxPendingSubmissions)) * 100))
                  : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Each file can be up to {formatBytes(summary?.quotas?.maxUploadSizeBytes)}.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

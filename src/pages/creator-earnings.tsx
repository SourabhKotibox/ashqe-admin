import { useMemo, useState } from "react";
import { Clock, Download, IndianRupee, Info, Loader2, Wallet } from "lucide-react";
import { useGetMovies, useGetTVShows, getImageUrl } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentPerformancePanel } from "@/components/content-performance";
import {
  ChangeChip,
  EarningsChart,
  Pager,
  PeriodFilter,
  QueryState,
  RevenueStat,
  RevenueTitlesTable,
  SourceBadge,
} from "@/components/creator-revenue-ui";
import {
  defaultPeriodSelection,
  fetchAllCreatorTitles,
  formatInr,
  formatPeriodRange,
  formatRate,
  formatWatchHours,
  isPeriodReady,
  percentChange,
  previousPeriod,
  titlesToCsv,
  useCreatorRevenueSeries,
  useCreatorRevenueSummary,
  useCreatorRevenueTitles,
  type PeriodSelection,
  type RevenueTitle,
} from "@/lib/creator-revenue";

export default function CreatorEarningsPage() {
  const [selection, setSelection] = useState<PeriodSelection>(defaultPeriodSelection());
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const ready = isPeriodReady(selection);
  const prior = previousPeriod(selection);
  const summaryQuery = useCreatorRevenueSummary(selection);
  const priorQuery = useCreatorRevenueSummary(prior || selection, !!prior);
  const seriesQuery = useCreatorRevenueSeries(selection);
  const titlesQuery = useCreatorRevenueTitles(selection, page);
  const leaderboardQuery = useCreatorRevenueTitles(selection, 1, 100);
  const movies = useGetMovies({ limit: 100, page: 1 });
  const shows = useGetTVShows({ limit: 100, page: 1 });

  const summary = summaryQuery.data?.data;
  const priorSummary = prior ? priorQuery.data?.data : undefined;
  const points = seriesQuery.data?.data?.points || [];
  const items = titlesQuery.data?.data?.items || [];
  const pagination = titlesQuery.data?.pagination;
  const leaders = useMemo(() => {
    const rows = [...(leaderboardQuery.data?.data?.items || [])];
    rows.sort((a, b) => b.amountInr - a.amountInr || b.watchHours - a.watchHours);
    return rows.slice(0, 5);
  }, [leaderboardQuery.data]);

  const thumbnails = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of movies.data?.data || []) {
      const id = String(row.id || row._id || "");
      const image = row.thumbnail || row.posterImage;
      if (id && image) map[id] = getImageUrl(image);
    }
    for (const row of shows.data?.data || []) {
      const id = String(row.id || row._id || "");
      const image = row.thumbnail || row.posterImage;
      if (id && image) map[id] = getImageUrl(image);
    }
    return map;
  }, [movies.data, shows.data]);

  const changePeriod = (next: PeriodSelection) => {
    setSelection(next);
    setPage(1);
  };

  const exportCsv = async () => {
    if (!ready) return;
    setExporting(true);
    setExportError(null);
    try {
      const all = await fetchAllCreatorTitles(selection);
      const csv = titlesToCsv(all);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ashqe-earnings-${selection.period}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setExportError(error?.message || "Could not export earnings.");
    } finally {
      setExporting(false);
    }
  };

  const earningsChange = prior && priorSummary && summary
    ? percentChange(summary.amountInr, priorSummary.amountInr)
    : undefined;
  const hoursChange = prior && priorSummary && summary
    ? percentChange(summary.watchHours, priorSummary.watchHours)
    : undefined;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/15 via-primary/10 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              <IndianRupee className="h-3.5 w-3.5" /> Earnings
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Revenue</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Watch time on your published movies and series, paid in INR at the rate in effect when the time was credited.
              {summary?.period ? ` ${formatPeriodRange(summary.period)}.` : ""}
            </p>
          </div>
          <PeriodFilter value={selection} onChange={changePeriod} />
        </div>
      </section>

      {!ready ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Pick a valid custom range to load earnings. A custom range can be at most 366 days.
        </div>
      ) : summaryQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : summaryQuery.isError ? (
        <QueryState isError error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <RevenueStat icon={Wallet} label="Earnings" value={formatInr(summary?.amountInr || 0)} hint={summary?.currency || "INR"} />
            <ChangeChip change={priorQuery.isSuccess ? earningsChange : undefined} />
          </div>
          <div className="space-y-1">
            <RevenueStat icon={Clock} label="Watch hours" value={formatWatchHours(summary?.watchHours || 0)} hint={`${summary?.titleCount ?? 0} titles with watch time`} />
            <ChangeChip change={priorQuery.isSuccess ? hoursChange : undefined} />
          </div>
          <RevenueStat
            icon={IndianRupee}
            label="Your rate"
            value={formatRate(summary?.rate?.rateInrPerHour || 0)}
            hint={summary?.rate?.source === "override" ? "Personal override" : "Global default"}
          />
        </div>
      )}

      {ready && summary && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SourceBadge source={summary.rate?.source} />
          <span>
            {summary.rate?.source === "override"
              ? "This override applies to new watch time. Hours already credited stay on the rate from that day."
              : "You are on the global default. A later default change applies only to watch time credited after it."}
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Daily earnings</CardTitle>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!ready || exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {exportError && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{exportError}</p>}
          {ready && (
            <EarningsChart
              points={points}
              isLoading={seriesQuery.isLoading}
              isError={seriesQuery.isError}
              error={seriesQuery.error}
              onRetry={() => seriesQuery.refetch()}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top titles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!ready ? null : leaderboardQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : leaders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No titles earned watch time in this period.</p>
            ) : leaders.map((item, index) => (
              <LeaderRow key={item.titleId} rank={index + 1} item={item} image={thumbnails[item.titleId]} />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" /> How earnings are calculated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Earnings are watch hours multiplied by your INR rate per hour. One hour at ₹5 is ₹5.</p>
            <p>The rate is saved with each bit of watch time. Changing your rate, or the global default, does not rewrite earnings already recorded.</p>
            <p>Only published movies and series you own count. Episode time is paid to the series owner. Days are counted in Asia/Kolkata.</p>
            {summary?.ratePolicy && <p>{summary.ratePolicy}</p>}
          </CardContent>
        </Card>
      </div>

      <ContentPerformancePanel scope="creator" />

      <div className="space-y-3">
        <h2 className="text-base font-semibold">By title</h2>
        {ready && (
          <RevenueTitlesTable
            items={items}
            thumbnails={thumbnails}
            isLoading={titlesQuery.isLoading}
            isError={titlesQuery.isError}
            error={titlesQuery.error}
            onRetry={() => titlesQuery.refetch()}
            emptyLabel="No watch time on your titles in this period."
          />
        )}
        <Pager page={pagination?.page || page} pages={pagination?.pages || 0} onPage={setPage} />
      </div>
    </div>
  );
}

function LeaderRow({ rank, item, image }: { rank: number; item: RevenueTitle; image?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
      <span className="w-5 text-sm font-bold text-muted-foreground">{rank}</span>
      <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {(item.title || "?").slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title || "Untitled"}</p>
        <p className="text-xs text-muted-foreground">{item.titleType === "series" ? "Series" : "Movie"} · {formatWatchHours(item.watchHours)}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{formatInr(item.amountInr)}</p>
    </div>
  );
}

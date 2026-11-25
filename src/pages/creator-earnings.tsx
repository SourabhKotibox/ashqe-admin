import { useState } from "react";
import { Clock, IndianRupee, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
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
  formatInr,
  formatPeriodRange,
  formatRate,
  formatWatchHours,
  isPeriodReady,
  useCreatorRevenueSeries,
  useCreatorRevenueSummary,
  useCreatorRevenueTitles,
  type PeriodSelection,
} from "@/lib/creator-revenue";

export default function CreatorEarningsPage() {
  const [selection, setSelection] = useState<PeriodSelection>(defaultPeriodSelection());
  const [page, setPage] = useState(1);
  const ready = isPeriodReady(selection);
  const summaryQuery = useCreatorRevenueSummary(selection);
  const seriesQuery = useCreatorRevenueSeries(selection);
  const titlesQuery = useCreatorRevenueTitles(selection, page);
  const summary = summaryQuery.data?.data;
  const points = seriesQuery.data?.data?.points || [];
  const items = titlesQuery.data?.data?.items || [];
  const pagination = titlesQuery.data?.pagination;

  const changePeriod = (next: PeriodSelection) => {
    setSelection(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-500">
            <IndianRupee className="h-3.5 w-3.5" /> Earnings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Revenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watch time on your published movies and series, paid in INR at your rate when the time was credited.
            {summary?.period ? ` ${formatPeriodRange(summary.period)}.` : ""}
          </p>
        </div>
        <PeriodFilter value={selection} onChange={changePeriod} />
      </div>

      {!ready ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Pick a valid custom range to load earnings.
        </div>
      ) : summaryQuery.isLoading || summaryQuery.isError ? (
        <QueryState
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          loadingLabel="Loading earnings"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <RevenueStat
            icon={Clock}
            label="Watch hours"
            value={formatWatchHours(summary?.watchHours || 0)}
            hint={`${summary?.titleCount ?? 0} titles with watch time`}
          />
          <RevenueStat
            icon={Wallet}
            label="Earnings"
            value={formatInr(summary?.amountInr || 0)}
            hint={summary?.currency || "INR"}
          />
          <RevenueStat
            icon={IndianRupee}
            label="Your rate"
            value={formatRate(summary?.rate?.rateInrPerHour || 0)}
            hint={summary?.rate?.source === "override" ? "Your personal rate" : "Global default"}
          />
        </div>
      )}

      {ready && summary && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SourceBadge source={summary.rate?.source} />
          <span>
            {summary.rate?.source === "override"
              ? "This override is your current rate. Earlier watch time stays on the rate that applied when it was credited."
              : "You are on the global default. A later default change applies only to watch time credited after it."}
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? null : (
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

      <div className="space-y-3">
        <h2 className="text-base font-semibold">By title</h2>
        {!ready ? null : (
          <RevenueTitlesTable
            items={items}
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

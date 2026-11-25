import { Fragment, useEffect, useState, type ComponentType } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type PeriodSelection,
  type RateHistoryEntry,
  type RevenuePeriodKey,
  type RevenueTitle,
  addIstDays,
  customPeriodError,
  errorMessage,
  formatDayKey,
  formatInr,
  formatIstDateTime,
  formatRate,
  formatWatchHours,
  istTodayKey,
  rateSourceLabel,
  validateRateInput,
} from "@/lib/creator-revenue";

const PERIODS: { id: RevenuePeriodKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
  { id: "all", label: "All time" },
];

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (next: PeriodSelection) => void;
}) {
  const customMessage = value.period === "custom" ? customPeriodError(value.from, value.to) : null;
  const needsDates = value.period === "custom" && !value.from && !value.to;

  const selectPeriod = (period: RevenuePeriodKey) => {
    if (period === "custom" && !value.from && !value.to) {
      const to = istTodayKey();
      onChange({ period, from: addIstDays(to, -29), to });
      return;
    }
    onChange({ ...value, period });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => {
          const active = value.period === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPeriod(item.id)}
              className={`px-3 h-9 rounded-lg text-sm font-semibold border ${
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {value.period === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="revenue-from" className="text-xs text-muted-foreground">From</Label>
            <Input
              id="revenue-from"
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label htmlFor="revenue-to" className="text-xs text-muted-foreground">To</Label>
            <Input
              id="revenue-to"
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
              className="w-[160px]"
            />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {needsDates
          ? "Choose a start and end date. Days are counted in Asia/Kolkata."
          : customMessage || "Days are counted in Asia/Kolkata."}
      </p>
    </div>
  );
}

export function RevenueStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  loadingLabel = "Loading",
}: {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
        <p className="font-semibold text-foreground">Could not load this</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error, "Try again in a moment.")}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    );
  }
  return null;
}

export function SourceBadge({ source }: { source?: string | null }) {
  const override = source === "override";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        override ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
      }`}
    >
      {rateSourceLabel(source)}
    </span>
  );
}

export function EarningsChart({
  points,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  points: Array<{ date: string; amountInr: number; watchHours: number; watchSeconds: number }>;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const state = <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={onRetry} loadingLabel="Loading chart" />;
  if (isLoading || isError) return state;
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No earnings in this period.
      </div>
    );
  }

  const chartColors = {
    grid: isDark ? "#27272a" : "#e4e4e7",
    axis: "#71717a",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e4e4e7",
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayKey}
            tick={{ fill: chartColors.axis, fontSize: 12 }}
            minTickGap={28}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatInr(Number(value))}
            tick={{ fill: chartColors.axis, fontSize: 12 }}
            width={84}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as { date: string; amountInr: number; watchHours: number };
              return (
                <div
                  className="rounded-lg border px-3 py-2 text-xs shadow-sm"
                  style={{ background: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder }}
                >
                  <p className="font-semibold">{formatDayKey(row.date)}</p>
                  <p className="mt-1">{formatInr(row.amountInr)}</p>
                  <p className="text-muted-foreground">{formatWatchHours(row.watchHours)}</p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="amountInr" stroke="#d97706" fill="#d97706" fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function episodeLabel(episode: { season: number | null; episode: number | null; title: string }) {
  const bits: string[] = [];
  if (episode.season != null) bits.push(`S${episode.season}`);
  if (episode.episode != null) bits.push(`E${episode.episode}`);
  return bits.length ? `${bits.join(" ")} · ${episode.title}` : episode.title;
}

export function RevenueTitlesTable({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  emptyLabel,
}: {
  items: RevenueTitle[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const state = <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={onRetry} loadingLabel="Loading titles" />;
  if (isLoading || isError) return state;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Watch hours</TableHead>
            <TableHead className="text-right">Earnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const series = item.titleType === "series";
            const episodes = series ? item.episodes || [] : [];
            const expanded = !!open[item.titleId];
            return (
              <Fragment key={item.titleId}>
                <TableRow>
                  <TableCell>
                    {series ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={expanded ? "Hide episodes" : "Show episodes"}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => setOpen((prev) => ({ ...prev, [item.titleId]: !prev[item.titleId] }))}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-medium">{item.title || "Untitled"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{series ? "Series" : "Movie"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWatchHours(item.watchHours)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatInr(item.amountInr)}</TableCell>
                </TableRow>
                {expanded && (
                  episodes.length === 0 ? (
                    <TableRow key={`${item.titleId}-empty`}>
                      <TableCell colSpan={5} className="bg-muted/30 text-sm text-muted-foreground">
                        No episode breakdown in this period.
                      </TableCell>
                    </TableRow>
                  ) : episodes.map((episode) => (
                    <TableRow key={episode.episodeId} className="bg-muted/30">
                      <TableCell />
                      <TableCell className="text-sm">{episodeLabel(episode)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Episode</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatWatchHours(episode.watchHours)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatInr(episode.amountInr)}</TableCell>
                    </TableRow>
                  ))
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function RateHistoryList({ history }: { history: RateHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No rate history yet.</p>;
  }
  return (
    <div className="space-y-2">
      {history.map((row) => (
        <div
          key={`${row.effectiveFrom}-${row.rateInrPerHour}-${row.opening ? "opening" : "change"}`}
          className="rounded-lg border border-border px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{formatRate(row.rateInrPerHour)}</p>
            <div className="flex items-center gap-2">
              {row.opening && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Opening default</span>
              )}
              <span className="text-xs text-muted-foreground">{formatIstDateTime(row.effectiveFrom)}</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.setBy ? `${row.setBy.name || "Staff"}${row.setBy.email ? ` · ${row.setBy.email}` : ""}` : "System"}
            {row.note ? ` · ${row.note}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

export function WatchHourRateForm({
  canEdit,
  rateInrPerHour,
  pending,
  submitLabel,
  idPrefix = "watch-hour",
  accessPending = false,
  onSave,
}: {
  canEdit: boolean;
  rateInrPerHour: number | null;
  pending?: boolean;
  submitLabel: string;
  idPrefix?: string;
  accessPending?: boolean;
  onSave: (body: { rateInrPerHour: number; note?: string }) => Promise<void> | void;
}) {
  const [rateInput, setRateInput] = useState(rateInrPerHour == null ? "" : String(rateInrPerHour));
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (rateInrPerHour == null) return;
    setRateInput(String(rateInrPerHour));
  }, [rateInrPerHour]);

  const submit = async () => {
    const parsed = validateRateInput(rateInput);
    if (parsed.ok === false) {
      setFormError(parsed.error);
      return;
    }
    setFormError(null);
    const trimmed = note.trim();
    try {
      await onSave({ rateInrPerHour: parsed.rateInrPerHour, note: trimmed || undefined });
      setNote("");
    } catch {
      // The caller reports the API error.
    }
  };

  if (accessPending) {
    return <p className="text-sm text-muted-foreground">Checking who can change rates…</p>;
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        Editing is turned off. Changing a rate needs creator revenue edit permission. Admins can view rates. Super admins can change them.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <Label htmlFor={`${idPrefix}-rate`}>INR per watch hour</Label>
          <Input
            id={`${idPrefix}-rate`}
            inputMode="decimal"
            value={rateInput}
            onChange={(event) => setRateInput(event.target.value)}
            placeholder="5.00"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-note`}>Note (optional)</Label>
          <Textarea
            id={`${idPrefix}-note`}
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this rate is changing"
            className="min-h-[40px]"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        0 to 100000, at most two decimal places. A rate of 0 pauses new earnings. This appends a history row and does not rewrite earnings already recorded.
      </p>
      {formError && <p className="text-sm text-rose-500">{formError}</p>}
      <Button type="button" onClick={submit} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      <span>{page} / {pages}</span>
      <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

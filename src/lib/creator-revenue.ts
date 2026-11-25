import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

/** Matches GET/PUT bodies on ashqe-api-server creator revenue (API PR #6). */

export type RevenuePeriodKey = "today" | "7d" | "30d" | "all" | "custom";

export type RevenuePeriod = {
  key: RevenuePeriodKey;
  from: string | null;
  to: string | null;
  timezone: "Asia/Kolkata";
};

export type MoneyFields = {
  watchSeconds: number;
  watchHours: number;
  amountPaise: number;
  amountInr: number;
};

export type RateSource = "override" | "default";

export type RateSetter = { id: string; name: string; email: string } | null;

export type RateHistoryEntry = {
  rateInrPerHour: number;
  effectiveFrom: string;
  note: string | null;
  opening: boolean;
  setBy: RateSetter;
};

export type CreatorRevenueSummary = {
  currency: "INR";
  timezone: "Asia/Kolkata";
  period: RevenuePeriod;
  rate: {
    currency: "INR";
    rateInrPerHour: number;
    effectiveFrom: string;
    source: RateSource;
  };
  ratePolicy: string;
  titleCount: number;
} & MoneyFields;

export type RevenueEpisode = {
  episodeId: string;
  season: number | null;
  episode: number | null;
  title: string;
} & MoneyFields;

export type RevenueTitle = {
  titleId: string;
  titleType: "movie" | "series";
  title: string;
  episodes?: RevenueEpisode[];
} & MoneyFields;

export type RevenueTitlesData = {
  currency: "INR";
  timezone: "Asia/Kolkata";
  period: RevenuePeriod;
  items: RevenueTitle[];
};

export type RevenuePagination = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type RevenuePoint = { date: string } & MoneyFields;

export type RevenueSeriesData = {
  currency: "INR";
  timezone: "Asia/Kolkata";
  period: RevenuePeriod;
  points: RevenuePoint[];
};

export type DefaultRatePayload = {
  scope: "default";
  currency: "INR";
  timezone: "Asia/Kolkata";
  rateInrPerHour: number;
  effectiveFrom: string;
  ratePolicy: string;
  history: RateHistoryEntry[];
};

export type CreatorRatePayload = {
  scope: "creator";
  creatorId: string;
  name: string;
  email: string;
  currency: "INR";
  timezone: "Asia/Kolkata";
  rateInrPerHour: number;
  effectiveFrom: string;
  source: RateSource;
  defaultRate: {
    rateInrPerHour: number;
    effectiveFrom: string;
  };
  ratePolicy: string;
  history: RateHistoryEntry[];
};

export type OverviewCreator = {
  creatorId: string;
  name: string;
  email: string;
  rateInrPerHour: number;
  rateEffectiveFrom: string;
  rateSource: RateSource;
  titles: RevenueTitle[];
} & MoneyFields;

export type RevenueOverviewData = {
  currency: "INR";
  timezone: "Asia/Kolkata";
  period: RevenuePeriod;
  totals: MoneyFields & { creatorCount: number };
  creators: OverviewCreator[];
};

export type PeriodSelection = {
  period: RevenuePeriodKey;
  from: string;
  to: string;
};

export type RateChangeBody = {
  rateInrPerHour: number;
  note?: string;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function istTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIstDays(dateKey: string, days: number) {
  const noon = new Date(`${dateKey}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(noon.getTime() + days * 86_400_000));
}

export function inclusiveDayCount(from: string, to: string) {
  const start = new Date(`${from}T12:00:00+05:30`).getTime();
  const end = new Date(`${to}T12:00:00+05:30`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

export function defaultPeriodSelection(): PeriodSelection {
  return { period: "30d", from: "", to: "" };
}

/** Empty custom dates are not an error yet; the caller asks the user to pick them. */
export function customPeriodError(from: string, to: string): string | null {
  if (!from && !to) return null;
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to)) return "Use start and end dates as YYYY-MM-DD.";
  if (from > to) return "The start date must be on or before the end date.";
  if (inclusiveDayCount(from, to) > 366) return "A custom period cannot be longer than 366 days.";
  return null;
}

export function isPeriodReady(selection: PeriodSelection) {
  if (selection.period !== "custom") return true;
  return DATE_KEY.test(selection.from) && DATE_KEY.test(selection.to) && customPeriodError(selection.from, selection.to) === null;
}

/** The window of the same length immediately before the selected period. All time has no comparison. */
export function previousPeriod(selection: PeriodSelection): PeriodSelection | null {
  if (!isPeriodReady(selection) || selection.period === "all") return null;
  const today = istTodayKey();
  if (selection.period === "today") {
    const day = addIstDays(today, -1);
    return { period: "custom", from: day, to: day };
  }
  if (selection.period === "7d") {
    return { period: "custom", from: addIstDays(today, -13), to: addIstDays(today, -7) };
  }
  if (selection.period === "30d") {
    return { period: "custom", from: addIstDays(today, -59), to: addIstDays(today, -30) };
  }
  const days = inclusiveDayCount(selection.from, selection.to);
  const to = addIstDays(selection.from, -1);
  const from = addIstDays(to, -(days - 1));
  return { period: "custom", from, to };
}

/** Null means the previous window was zero and this one is not, so there is no percentage. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function periodQueryString(
  selection: PeriodSelection,
  extra?: Record<string, string | number | undefined>
) {
  const params = new URLSearchParams();
  params.set("period", selection.period);
  if (selection.period === "custom") {
    params.set("from", selection.from);
    params.set("to", selection.to);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
  }
  return params.toString();
}

export function formatInr(amountInr: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amountInr) || 0);
}

export function formatRate(rateInrPerHour: number) {
  return `${formatInr(rateInrPerHour)} / hour`;
}

export function formatWatchHours(watchHours: number) {
  const n = Number(watchHours) || 0;
  return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(n)} h`;
}

export function formatDayKey(dateKey: string) {
  if (!DATE_KEY.test(dateKey)) return dateKey || "—";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatIstDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function formatPeriodRange(period?: RevenuePeriod | null) {
  if (!period) return "";
  if (!period.from || !period.to) return "All time";
  if (period.from === period.to) return formatDayKey(period.from);
  return `${formatDayKey(period.from)} – ${formatDayKey(period.to)}`;
}

export function rateSourceLabel(source?: string | null) {
  return source === "override" ? "Override" : "Default";
}

export function validateRateInput(raw: string): { ok: true; rateInrPerHour: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Enter a rate from 0 to 100000 with at most 2 decimal places." };
  }
  const rateInrPerHour = Number(trimmed);
  if (!Number.isFinite(rateInrPerHour) || rateInrPerHour < 0 || rateInrPerHour > 100000) {
    return { ok: false, error: "Enter a rate from 0 to 100000 with at most 2 decimal places." };
  }
  return { ok: true, rateInrPerHour };
}

export function errorMessage(error: unknown, fallback: string) {
  const err = error as {
    message?: string;
    details?: { errors?: Record<string, string[] | undefined> };
  };
  const fieldErrors = err?.details?.errors;
  if (fieldErrors) {
    const first = Object.values(fieldErrors).flat().find((item) => typeof item === "string" && item);
    if (first) return first;
  }
  if (err?.message) return err.message;
  return fallback;
}

type Wrapped<T> = { success?: boolean; data: T; pagination?: RevenuePagination };

const revenueKey = ["creator-revenue"] as const;

export function useCreatorRevenueSummary(selection: PeriodSelection, enabled = true) {
  const ready = isPeriodReady(selection) && enabled;
  return useQuery({
    queryKey: [...revenueKey, "summary", selection],
    queryFn: () =>
      apiRequest(`/api/creator/revenue/summary?${periodQueryString(selection)}`) as Promise<Wrapped<CreatorRevenueSummary>>,
    enabled: ready,
  });
}

export function useCreatorRevenueSeries(selection: PeriodSelection) {
  const ready = isPeriodReady(selection);
  return useQuery({
    queryKey: [...revenueKey, "series", selection],
    queryFn: () =>
      apiRequest(`/api/creator/revenue/timeseries?${periodQueryString(selection)}`) as Promise<Wrapped<RevenueSeriesData>>,
    enabled: ready,
  });
}

export function useCreatorRevenueTitles(selection: PeriodSelection, page: number, limit = 20) {
  const ready = isPeriodReady(selection);
  return useQuery({
    queryKey: [...revenueKey, "titles", selection, page, limit],
    queryFn: () =>
      apiRequest(
        `/api/creator/revenue/titles?${periodQueryString(selection, { page, limit })}`
      ) as Promise<Wrapped<RevenueTitlesData>>,
    enabled: ready,
  });
}

export function useDefaultCreatorRate(enabled = true) {
  return useQuery({
    queryKey: [...revenueKey, "default-rate"],
    queryFn: () => apiRequest("/api/admin/creator-revenue/rate") as Promise<Wrapped<DefaultRatePayload>>,
    enabled,
  });
}

export function useCreatorRate(creatorId?: string, enabled = true) {
  return useQuery({
    queryKey: [...revenueKey, "creator-rate", creatorId],
    queryFn: () =>
      apiRequest(
        `/api/admin/creator-revenue/creators/${encodeURIComponent(creatorId || "")}/rate`
      ) as Promise<Wrapped<CreatorRatePayload>>,
    enabled: enabled && !!creatorId,
  });
}

export function useCreatorRevenueOverview(
  selection: PeriodSelection,
  page: number,
  limit = 20,
  creatorId?: string
) {
  const ready = isPeriodReady(selection);
  return useQuery({
    queryKey: [...revenueKey, "overview", selection, page, limit, creatorId || ""],
    queryFn: () =>
      apiRequest(
        `/api/admin/creator-revenue/overview?${periodQueryString(selection, { page, limit, creatorId })}`
      ) as Promise<Wrapped<RevenueOverviewData>>,
    enabled: ready,
  });
}

export async function fetchAllCreatorTitles(selection: PeriodSelection) {
  const items: RevenueTitle[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 20) {
    const response = await apiRequest(
      `/api/creator/revenue/titles?${periodQueryString(selection, { page, limit: 100 })}`
    ) as Wrapped<RevenueTitlesData>;
    items.push(...(response.data?.items || []));
    pages = response.pagination?.pages || 1;
    page += 1;
  }
  return items;
}

export function titlesToCsv(items: RevenueTitle[]) {
  const rows = [["Title", "Type", "Episode", "Watch hours", "Earnings INR"]];
  for (const item of items) {
    rows.push([item.title, item.titleType === "series" ? "Series" : "Movie", "", String(item.watchHours), String(item.amountInr)]);
    for (const episode of item.episodes || []) {
      const label = [episode.season != null ? `S${episode.season}` : "", episode.episode != null ? `E${episode.episode}` : "", episode.title]
        .filter(Boolean)
        .join(" ");
      rows.push([item.title, "Episode", label, String(episode.watchHours), String(episode.amountInr)]);
    }
  }
  return rows.map((row) => row.map((cell) => {
    const text = String(cell ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n");
}

function invalidateRevenue(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: [...revenueKey] });
}

export function useSetDefaultCreatorRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RateChangeBody) =>
      apiRequest("/api/admin/creator-revenue/rate", {
        method: "PUT",
        body: JSON.stringify(body),
      }) as Promise<Wrapped<DefaultRatePayload>>,
    onSuccess: () => invalidateRevenue(qc),
  });
}

export function useSetCreatorRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorId, ...body }: RateChangeBody & { creatorId: string }) =>
      apiRequest(`/api/admin/creator-revenue/creators/${encodeURIComponent(creatorId)}/rate`, {
        method: "PUT",
        body: JSON.stringify(body),
      }) as Promise<Wrapped<CreatorRatePayload>>,
    onSuccess: () => invalidateRevenue(qc),
  });
}

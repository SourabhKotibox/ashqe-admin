import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, Clapperboard, Clock, Eye, IndianRupee, Loader2, Search, Users, Wallet, X } from "lucide-react";
import { getAdminUsers, getImageUrl, useDeleteMovie, useDeleteTVShow, useGetMe } from "@/lib/api-client";
import { canAdminDeleteTitle } from "@/lib/creator-access";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pager, PeriodFilter, QueryState, RevenueStat, SourceBadge } from "@/components/creator-revenue-ui";
import {
  contentStatusLabel,
  errorMessage,
  formatCount,
  formatInr,
  formatPeriodRange,
  formatRate,
  formatWatchHours,
  isPeriodReady,
  useContentAnalytics,
  type ContentAnalyticsEpisode,
  type ContentAnalyticsItem,
  type ContentAnalyticsOrder,
  type ContentAnalyticsQuery,
  type ContentAnalyticsScope,
  type ContentAnalyticsSort,
  type ContentAnalyticsStatus,
  type PeriodSelection,
} from "@/lib/creator-revenue";

const STATUS_OPTIONS: { value: "" | ContentAnalyticsStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "moderation", label: "In review" },
  { value: "rejected", label: "Rejected" },
  { value: "removed", label: "Removed" },
];

const STATUS_TONE: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  processing: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  moderation: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  removed: "bg-muted text-muted-foreground",
};

type DirectoryCreator = { id: string; name: string; email: string };

function posterUrl(item: { poster?: string | null; thumbnail?: string | null }) {
  const raw = item.poster || item.thumbnail;
  return raw ? getImageUrl(raw) : "";
}

function removedRow(item: ContentAnalyticsItem) {
  return !item.inCatalog || item.status === "removed";
}

function episodeLabel(episode: ContentAnalyticsEpisode) {
  const bits: string[] = [];
  if (episode.season != null) bits.push(`S${episode.season}`);
  if (episode.episode != null) bits.push(`E${episode.episode}`);
  return bits.length ? `${bits.join(" ")} · ${episode.title}` : episode.title || "Episode";
}

function editHref(item: ContentAnalyticsItem) {
  return item.type === "series" ? `/tv-shows/${item.contentId}/edit` : `/movies/${item.contentId}/edit`;
}

export function ContentPerformancePanel({
  scope,
  creatorId,
  initialSelection,
  embedded = false,
  heading = "Content performance",
}: {
  scope: ContentAnalyticsScope;
  creatorId?: string;
  initialSelection?: PeriodSelection;
  embedded?: boolean;
  heading?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const [selection, setSelection] = useState<PeriodSelection>(initialSelection || { period: "all", from: "", to: "" });
  const [sort, setSort] = useState<ContentAnalyticsSort>("watchHours");
  const [order, setOrder] = useState<ContentAnalyticsOrder>("desc");
  const [type, setType] = useState<ContentAnalyticsQuery["type"]>("");
  const [status, setStatus] = useState<ContentAnalyticsQuery["status"]>("");
  const [page, setPage] = useState(1);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [creatorLabel, setCreatorLabel] = useState("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<ContentAnalyticsItem | null>(null);
  const deleteMovie = useDeleteMovie();
  const deleteShow = useDeleteTVShow();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(creatorSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [creatorSearch]);

  const filters = useMemo<ContentAnalyticsQuery>(() => ({
    selection,
    sort,
    order,
    type,
    status,
    page,
    limit: 20,
    creatorId: scope === "admin-all" ? creatorFilter : undefined,
  }), [selection, sort, order, type, status, page, scope, creatorFilter]);

  const analytics = useContentAnalytics(scope, filters, creatorId);
  const directory = useQuery({
    queryKey: ["admin-users", { role: "influencer", status: "active", search: debouncedSearch, limit: 8, page: 1, source: "content-analytics" }],
    queryFn: () => getAdminUsers({ role: "influencer", status: "active", search: debouncedSearch, limit: 8, page: 1 }),
    enabled: scope === "admin-all" && debouncedSearch.length > 0,
  });

  const ready = isPeriodReady(selection);
  const data = analytics.data?.data;
  const items = data?.items || [];
  const pagination = analytics.data?.pagination;
  const totals = data?.totals;
  const showCreator = scope === "admin-all" && !creatorFilter;
  const showActions = scope !== "creator";
  const columnCount = 8 + (showCreator ? 1 : 0) + (showActions ? 1 : 0);
  const deleting = deleteMovie.isPending || deleteShow.isPending;

  const directoryRows: DirectoryCreator[] = (directory.data?.data || [])
    .map((row: { id?: string; _id?: string; name?: string; email?: string }) => ({
      id: String(row.id || row._id || ""),
      name: row.name || "Creator",
      email: row.email || "",
    }))
    .filter((row: DirectoryCreator) => row.id);

  const changeSelection = (next: PeriodSelection) => {
    setSelection(next);
    setPage(1);
  };

  const toggleSort = (next: ContentAnalyticsSort) => {
    if (sort === next) setOrder((current) => current === "desc" ? "asc" : "desc");
    else {
      setSort(next);
      setOrder("desc");
    }
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === "series") await deleteShow.mutateAsync(pendingDelete.contentId);
      else await deleteMovie.mutateAsync(pendingDelete.contentId);
      await queryClient.invalidateQueries({ queryKey: ["creator-revenue", "content-analytics"] });
      toast({
        title: pendingDelete.type === "series" ? "Web series deleted" : "Movie deleted",
        description: pendingDelete.title || "Removed from the catalog. Watch time already credited stays in the ledger.",
      });
      setPendingDelete(null);
    } catch (error) {
      toast({ title: "Could not delete this title", description: errorMessage(error, "Try again."), variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4">
      {heading ? <h2 className={embedded ? "text-sm font-semibold" : "text-base font-semibold"}>{heading}</h2> : null}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <PeriodFilter value={selection} onChange={changeSelection} />
        <div className="flex flex-wrap gap-2">
          <Select value={type || "all"} onValueChange={(value) => { setType(value === "all" ? "" : value as ContentAnalyticsQuery["type"]); setPage(1); }}>
            <SelectTrigger className="w-[140px] bg-card"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="series">Series</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(value) => { setStatus(value === "all" ? "" : value as ContentAnalyticsQuery["status"]); setPage(1); }}>
            <SelectTrigger className="w-[150px] bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value || "all"}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            <SortButton active={sort === "watchHours"} order={order} onClick={() => toggleSort("watchHours")}>Watch hours</SortButton>
            <SortButton active={sort === "revenue"} order={order} onClick={() => toggleSort("revenue")}>Revenue</SortButton>
          </div>
        </div>
      </div>

      {scope === "admin-all" && (
        <CreatorLookup
          search={creatorSearch}
          onSearch={setCreatorSearch}
          selectedId={creatorFilter}
          selectedLabel={creatorLabel}
          rows={directoryRows}
          loading={directory.isLoading && debouncedSearch.length > 0}
          error={directory.isError ? errorMessage(directory.error, "Creator search is unavailable.") : null}
          onPick={(row) => {
            setCreatorFilter(row.id);
            setCreatorLabel(row.email ? `${row.name} · ${row.email}` : row.name);
            setCreatorSearch("");
            setPage(1);
          }}
          onClear={() => {
            setCreatorFilter("");
            setCreatorLabel("");
            setPage(1);
          }}
        />
      )}

      {data?.revenueNote && (
        <p className="text-xs text-muted-foreground">{data.revenueNote}</p>
      )}
      {data?.rate && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Current rate {formatRate(data.rate.rateInrPerHour)}</span>
          <SourceBadge source={data.rate.rateSource} />
          <span>Credited revenue uses the rate from the day the watch time was recorded.</span>
        </p>
      )}

      {ready && !analytics.isLoading && !analytics.isError && totals && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <RevenueStat icon={Clapperboard} label="Titles" value={formatCount(totals.contentCount)} hint={`${formatCount(totals.movieCount)} movies · ${formatCount(totals.seriesCount)} series`} />
          <RevenueStat icon={Clock} label="Watch hours" value={formatWatchHours(totals.watchHours)} hint={data?.period ? formatPeriodRange(data.period) : "Full filtered set"} />
          <RevenueStat icon={Wallet} label="Revenue" value={formatInr(totals.amountInr)} hint={data?.currency || "INR"} />
          <RevenueStat icon={Eye} label="Views" value={formatCount(totals.views)} hint="Lifetime, not this period" />
          <RevenueStat icon={Users} label="Unique viewers" value={formatCount(totals.uniqueViewers)} hint="Distinct viewers in this period" />
          <RevenueStat icon={IndianRupee} label="Earning units" value={formatCount(totals.earningUnits)} hint="Exact credited units" />
        </div>
      )}

      {!ready ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Pick a valid custom range to load content performance. A custom range can be at most 366 days.
        </div>
      ) : analytics.isLoading || analytics.isError ? (
        <QueryState
          isLoading={analytics.isLoading}
          isError={analytics.isError}
          error={analytics.error}
          onRetry={() => analytics.refetch()}
          loadingLabel="Loading content performance"
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No content matches these filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <ContentCard
                key={item.contentId}
                item={item}
                expanded={!!open[item.contentId]}
                onToggle={() => setOpen((prev) => ({ ...prev, [item.contentId]: !prev[item.contentId] }))}
                showCreator={showCreator}
                showActions={showActions}
                canDelete={canAdminDeleteTitle(me, item.type)}
                onDelete={() => setPendingDelete(item)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  {showCreator && <TableHead>Creator</TableHead>}
                  <TableHead className="text-right">
                    <HeaderSort label="Watch hours" active={sort === "watchHours"} order={order} onClick={() => toggleSort("watchHours")} />
                  </TableHead>
                  <TableHead className="text-right" title="Distinct viewers in this period">Unique viewers</TableHead>
                  <TableHead className="text-right" title="Lifetime catalog views. This number does not follow the date range.">Views (lifetime)</TableHead>
                  <TableHead className="text-right">
                    <HeaderSort label="Revenue" active={sort === "revenue"} order={order} onClick={() => toggleSort("revenue")} />
                  </TableHead>
                  {showActions && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const series = item.type === "series";
                  const episodes = series ? item.episodes || [] : [];
                  const expanded = !!open[item.contentId];
                  const gone = removedRow(item);
                  return (
                    <Fragment key={item.contentId}>
                      <TableRow className={gone ? "opacity-60" : undefined}>
                        <TableCell>
                          {series ? (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={expanded ? "Hide episodes" : "Show episodes"}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => setOpen((prev) => ({ ...prev, [item.contentId]: !prev[item.contentId] }))}
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          <TitleCell item={item} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{series ? "Series" : "Movie"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        {showCreator && (
                          <TableCell>
                            <p className="font-medium">{item.creatorName || "Creator"}</p>
                            <p className="text-xs text-muted-foreground">{item.creatorEmail}</p>
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">{formatWatchHours(item.watchHours)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCount(item.uniqueViewers)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span title="Lifetime views, not limited to this period">{formatCount(item.views)}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatInr(item.amountInr)}</TableCell>
                        {showActions && (
                          <TableCell className="text-right">
                            <RowActions
                              item={item}
                              canDelete={canAdminDeleteTitle(me, item.type)}
                              onDelete={() => setPendingDelete(item)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                      {expanded && (
                        episodes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={columnCount} className="bg-muted/30 text-sm text-muted-foreground">
                              No episodes on this series.
                            </TableCell>
                          </TableRow>
                        ) : episodes.map((episode) => (
                          <TableRow key={episode.episodeId} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="text-sm">{episodeLabel(episode)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">Episode</TableCell>
                            <TableCell />
                            {showCreator && <TableCell />}
                            <TableCell className="text-right text-sm tabular-nums">{formatWatchHours(episode.watchHours)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatCount(episode.uniqueViewers)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatCount(episode.views)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatInr(episode.amountInr)}</TableCell>
                            {showActions && <TableCell />}
                          </TableRow>
                        ))
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Pager page={pagination?.page || page} pages={pagination?.pages || 0} onPage={setPage} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(next) => { if (!next && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.type === "series" ? "web series" : "movie"}</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Delete "{pendingDelete?.title || "this title"}"? This removes it from the catalog. Watch time already credited stays on the ledger and the row will show as removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-muted" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-primary hover:bg-primary/90 text-white">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SortButton({
  active,
  order,
  onClick,
  children,
}: {
  active: boolean;
  order: ContentAnalyticsOrder;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md px-3 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
    >
      {children}{active ? (order === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function HeaderSort({
  label,
  active,
  order,
  onClick,
}: {
  label: string;
  active: boolean;
  order: ContentAnalyticsOrder;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 font-medium">
      {label}
      <span aria-hidden className="text-xs">{active ? (order === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const tone = STATUS_TONE[status || ""] || "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {contentStatusLabel(status)}
    </span>
  );
}

function TitleCell({ item }: { item: ContentAnalyticsItem }) {
  const image = posterUrl(item);
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {(item.title || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <span className="min-w-0">{item.title || "Untitled"}</span>
    </div>
  );
}

function RowActions({
  item,
  canDelete,
  onDelete,
}: {
  item: ContentAnalyticsItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  if (removedRow(item)) {
    return <span className="text-xs text-muted-foreground">Removed</span>;
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={editHref(item)} className="text-sm font-semibold text-primary hover:underline">Edit</Link>
      {canDelete && (
        <Button type="button" size="sm" variant="outline" onClick={onDelete}>Delete</Button>
      )}
    </div>
  );
}

function ContentCard({
  item,
  expanded,
  onToggle,
  showCreator,
  showActions,
  canDelete,
  onDelete,
}: {
  item: ContentAnalyticsItem;
  expanded: boolean;
  onToggle: () => void;
  showCreator: boolean;
  showActions: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const series = item.type === "series";
  const episodes = series ? item.episodes || [] : [];
  const gone = removedRow(item);
  return (
    <article className={`rounded-xl border border-border bg-card p-3 ${gone ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
          {posterUrl(item) ? <img src={posterUrl(item)} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug">{item.title || "Untitled"}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {series ? `Series${item.episodeCount != null ? ` · ${item.episodeCount} episodes` : ""}` : "Movie"}
            {showCreator && item.creatorName ? ` · ${item.creatorName}` : ""}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Watch hours</dt><dd className="font-semibold tabular-nums">{formatWatchHours(item.watchHours)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Revenue</dt><dd className="font-semibold tabular-nums">{formatInr(item.amountInr)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Unique viewers</dt><dd className="tabular-nums">{formatCount(item.uniqueViewers)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Views (lifetime)</dt><dd className="tabular-nums">{formatCount(item.views)}</dd></div>
      </dl>
      {series && (
        <button type="button" onClick={onToggle} className="mt-3 text-sm font-semibold text-primary" aria-expanded={expanded}>
          {expanded ? "Hide episodes" : "Show episodes"}
        </button>
      )}
      {expanded && (
        <ul className="mt-2 space-y-2 border-t border-border pt-2">
          {episodes.length === 0 ? <li className="text-sm text-muted-foreground">No episodes on this series.</li> : episodes.map((episode) => (
            <li key={episode.episodeId} className="text-sm">
              <p className="font-medium">{episodeLabel(episode)}</p>
              <p className="text-xs text-muted-foreground">
                {formatWatchHours(episode.watchHours)} · {formatInr(episode.amountInr)} · {formatCount(episode.uniqueViewers)} viewers · {formatCount(episode.views)} views
              </p>
            </li>
          ))}
        </ul>
      )}
      {showActions && (
        <div className="mt-3">
          <RowActions item={item} canDelete={canDelete} onDelete={onDelete} />
        </div>
      )}
    </article>
  );
}

function CreatorLookup({
  search,
  onSearch,
  selectedId,
  selectedLabel,
  rows,
  loading,
  error,
  onPick,
  onClear,
}: {
  search: string;
  onSearch: (value: string) => void;
  selectedId: string;
  selectedLabel: string;
  rows: DirectoryCreator[];
  loading: boolean;
  error: string | null;
  onPick: (row: DirectoryCreator) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Filter by creator name or email"
          className="pl-9"
          aria-label="Filter by creator"
        />
      </div>
      {selectedId && (
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          <span>{selectedLabel || "Selected creator"}</span>
          <button type="button" onClick={onClear} aria-label="Clear creator filter" className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {loading && <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching creators…</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {!loading && search.trim() && rows.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No active creator matches that search.</p>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col gap-1">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick(row)}
              className="rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
            >
              <span className="block text-sm font-medium">{row.name}</span>
              <span className="block text-xs text-muted-foreground">{row.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

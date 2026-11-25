import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, IndianRupee, Search, Users, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getAdminUsers, useGetMe } from "@/lib/api-client";
import { canEditCreatorRevenue, canViewCreatorProfile } from "@/lib/creator-access";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pager,
  PeriodFilter,
  QueryState,
  RateHistoryList,
  RevenueStat,
  RevenueTitlesTable,
  SourceBadge,
  WatchHourRateForm,
} from "@/components/creator-revenue-ui";
import {
  defaultPeriodSelection,
  errorMessage,
  formatInr,
  formatPeriodRange,
  formatRate,
  formatWatchHours,
  isPeriodReady,
  useCreatorRate,
  useCreatorRevenueOverview,
  useDefaultCreatorRate,
  useSetCreatorRate,
  useSetDefaultCreatorRate,
  type OverviewCreator,
  type PeriodSelection,
} from "@/lib/creator-revenue";

type DirectoryCreator = { id: string; name: string; email: string };

export default function AdminCreatorRevenuePage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const canEdit = !!me && canEditCreatorRevenue(me);
  const canOpenProfile = canViewCreatorProfile(me);
  const { toast } = useToast();
  const [selection, setSelection] = useState<PeriodSelection>(defaultPeriodSelection());
  const [page, setPage] = useState(1);
  const [openCreator, setOpenCreator] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const ready = isPeriodReady(selection);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(creatorSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [creatorSearch]);

  const overviewQuery = useCreatorRevenueOverview(selection, page);
  const defaultRateQuery = useDefaultCreatorRate();
  const setDefaultRate = useSetDefaultCreatorRate();
  const directory = useQuery({
    queryKey: ["admin-users", { role: "influencer", status: "active", search: debouncedSearch, limit: 8, page: 1 }],
    queryFn: () => getAdminUsers({ role: "influencer", status: "active", search: debouncedSearch, limit: 8, page: 1 }),
    enabled: debouncedSearch.length > 0,
  });

  const overview = overviewQuery.data?.data;
  const creators = overview?.creators || [];
  const pagination = overviewQuery.data?.pagination;
  const defaultRate = defaultRateQuery.data?.data;
  const directoryRows: DirectoryCreator[] = (directory.data?.data || [])
    .map((row: { id?: string; _id?: string; name?: string; email?: string }) => ({
      id: String(row.id || row._id || ""),
      name: row.name || "Creator",
      email: row.email || "",
    }))
    .filter((row: DirectoryCreator) => row.id);
  const inlineEditorVisible = !!editingId && openCreator === editingId && creators.some((creator) => creator.creatorId === editingId);

  const changePeriod = (next: PeriodSelection) => {
    setSelection(next);
    setPage(1);
  };

  const saveDefault = async (body: { rateInrPerHour: number; note?: string }) => {
    try {
      await setDefaultRate.mutateAsync(body);
      toast({ title: "Default rate updated", description: "Creators without an override use this rate for new watch time." });
    } catch (error) {
      toast({ title: "Could not update the default rate", description: errorMessage(error, "Try again."), variant: "destructive" });
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Creator revenue</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Watch hours and INR earnings across creators. Totals use the rate that was in effect when each hour was credited.
            {overview?.period ? ` ${formatPeriodRange(overview.period)}.` : ""}
          </p>
        </div>
        <PeriodFilter value={selection} onChange={changePeriod} />
      </div>

      {ready && (overviewQuery.isLoading || overviewQuery.isError ? (
        <QueryState
          isLoading={overviewQuery.isLoading}
          isError={overviewQuery.isError}
          error={overviewQuery.error}
          onRetry={() => overviewQuery.refetch()}
          loadingLabel="Loading overview"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RevenueStat icon={Clock} label="Watch hours" value={formatWatchHours(overview?.totals?.watchHours || 0)} hint="Full filter, every page" />
          <RevenueStat icon={Wallet} label="Earnings" value={formatInr(overview?.totals?.amountInr || 0)} hint={overview?.currency || "INR"} />
          <RevenueStat icon={Users} label="Creators" value={String(overview?.totals?.creatorCount ?? 0)} hint="With watch time in this period" />
          <RevenueStat
            icon={IndianRupee}
            label="Default rate"
            value={defaultRate ? formatRate(defaultRate.rateInrPerHour) : "—"}
            hint="Used when a creator has no override"
          />
        </div>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Default rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {defaultRateQuery.isLoading || defaultRateQuery.isError ? (
            <QueryState
              isLoading={defaultRateQuery.isLoading}
              isError={defaultRateQuery.isError}
              error={defaultRateQuery.error}
              onRetry={() => defaultRateQuery.refetch()}
              loadingLabel="Loading the default rate"
            />
          ) : defaultRate ? (
            <>
              <p className="text-sm text-muted-foreground">{defaultRate.ratePolicy}</p>
              <WatchHourRateForm
                idPrefix="default-rate"
                accessPending={meLoading}
                canEdit={canEdit}
                rateInrPerHour={defaultRate.rateInrPerHour}
                pending={setDefaultRate.isPending}
                submitLabel="Update default rate"
                onSave={saveDefault}
              />
              <div>
                <p className="mb-2 text-sm font-semibold">History</p>
                <RateHistoryList history={defaultRate.history || []} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Find a creator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The table lists creators who have credited watch time in the selected period. Search here to set a rate for a creator who has not earned anything yet.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={creatorSearch}
              onChange={(event) => setCreatorSearch(event.target.value)}
              placeholder="Name or email"
              className="pl-9"
            />
          </div>
          {debouncedSearch && (
            directory.isLoading ? (
              <p className="text-sm text-muted-foreground">Searching creators…</p>
            ) : directoryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active creator matches that search.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {directoryRows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(row.id);
                        setOpenCreator(row.id);
                      }}
                    >
                      {canEdit ? "Edit rate" : "View rate"}
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
          {editingId && !inlineEditorVisible && (
            <CreatorRateEditor creatorId={editingId} canEdit={canEdit} accessPending={meLoading} onClose={() => setEditingId(null)} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Creators</h2>
        {!ready ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Pick a valid custom range to load the overview.
          </div>
        ) : overviewQuery.isLoading || overviewQuery.isError ? null : creators.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No creator earnings in this period.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Creator</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Watch hours</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {creators.map((creator) => (
                  <CreatorRows
                    key={creator.creatorId}
                    creator={creator}
                    open={openCreator === creator.creatorId}
                    editing={editingId === creator.creatorId}
                    canEdit={canEdit}
                    canOpenProfile={canOpenProfile}
                    accessPending={meLoading}
                    onToggle={() => setOpenCreator((current) => current === creator.creatorId ? null : creator.creatorId)}
                    onEdit={() => {
                      setOpenCreator(creator.creatorId);
                      setEditingId((current) => current === creator.creatorId ? null : creator.creatorId);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={pagination?.page || page} pages={pagination?.pages || 0} onPage={setPage} />
      </div>
    </div>
  );
}

function CreatorRows({
  creator,
  open,
  editing,
  canEdit,
  canOpenProfile,
  accessPending,
  onToggle,
  onEdit,
}: {
  creator: OverviewCreator;
  open: boolean;
  editing: boolean;
  canEdit: boolean;
  canOpenProfile: boolean;
  accessPending: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide titles" : "Show titles"}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onToggle}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell>
          {canOpenProfile ? (
            <Link href={`/creators/${creator.creatorId}`} className="font-medium text-foreground hover:underline">
              {creator.name || "Unknown"}
            </Link>
          ) : (
            <p className="font-medium">{creator.name || "Unknown"}</p>
          )}
          <p className="text-xs text-muted-foreground">{creator.email}</p>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{formatRate(creator.rateInrPerHour)}</span>
            <SourceBadge source={creator.rateSource} />
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatWatchHours(creator.watchHours)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{formatInr(creator.amountInr)}</TableCell>
        <TableCell className="text-right">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            {editing ? "Hide" : canEdit ? "Edit rate" : "Rate history"}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20">
            <div className="space-y-4 py-2">
              <RevenueTitlesTable
                items={creator.titles || []}
                emptyLabel="No title breakdown in this period."
              />
              {editing && <CreatorRateEditor creatorId={creator.creatorId} canEdit={canEdit} accessPending={accessPending} />}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function CreatorRateEditor({
  creatorId,
  canEdit,
  accessPending = false,
  onClose,
}: {
  creatorId: string;
  canEdit: boolean;
  accessPending?: boolean;
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const query = useCreatorRate(creatorId);
  const save = useSetCreatorRate();
  const rate = query.data?.data;

  const onSave = async (body: { rateInrPerHour: number; note?: string }) => {
    try {
      await save.mutateAsync({ creatorId, ...body });
      toast({
        title: "Creator rate updated",
        description: "New watch time uses this rate. Earnings already recorded are unchanged.",
      });
    } catch (error) {
      toast({ title: "Could not update this rate", description: errorMessage(error, "Try again."), variant: "destructive" });
      throw error;
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{rate?.name || "Creator rate"}</p>
          <p className="text-xs text-muted-foreground">{rate?.email}</p>
        </div>
        {onClose && (
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>
        )}
      </div>
      {query.isLoading || query.isError ? (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          loadingLabel="Loading rate history"
        />
      ) : rate ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{formatRate(rate.rateInrPerHour)}</span>
            <SourceBadge source={rate.source} />
            <span className="text-muted-foreground">
              Global default {formatRate(rate.defaultRate.rateInrPerHour)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{rate.ratePolicy}</p>
          <WatchHourRateForm
            idPrefix={`creator-rate-${creatorId}`}
            canEdit={canEdit}
            accessPending={accessPending}
            rateInrPerHour={rate.rateInrPerHour}
            pending={save.isPending}
            submitLabel="Save creator rate"
            onSave={onSave}
          />
          <div>
            <p className="mb-2 text-sm font-semibold">Override history</p>
            <RateHistoryList history={rate.history || []} />
          </div>
        </>
      ) : null}
    </div>
  );
}

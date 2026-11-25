import { useState } from "react";
import { Link } from "wouter";
import { Check, Copy, ExternalLink, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@/lib/api-client";
import { canViewCreatorProfile, canViewCreatorRevenueAdmin } from "@/lib/creator-access";
import {
  applicationIdOf, fmtDateTime, useAdminCreatorApplication, useAdminCreatorApplications,
  useApproveCreatorApplication, useRejectCreatorApplication,
} from "@/lib/creator-api";
import { formatRate, useCreatorRate, useDefaultCreatorRate } from "@/lib/creator-revenue";
import { SourceBadge } from "@/components/creator-revenue-ui";

const BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  under_review: "bg-sky-500/15 text-sky-500",
  approved: "bg-emerald-500/15 text-emerald-500",
  rejected: "bg-rose-500/15 text-rose-500",
};

const StatusBadge = ({ s }: { s?: string }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${BADGE[s || ""] || "bg-muted text-muted-foreground"}`}>
    {(s || "unknown").replace("_", " ")}
  </span>
);

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export default function CreatorApplicationsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<(typeof TABS)[number]["id"]>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminCreatorApplications({ status, search, page, limit: 20 });
  const rows = q.data?.data || [];
  const counts = q.data?.counts || {};
  const pagination = q.data?.pagination;
  const pageCount = pagination?.pages || pagination?.totalPages || 1;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [credentials, setCredentials] = useState<any>(null);

  const detail = useAdminCreatorApplication(selectedId || undefined);
  const listRow = rows.find((row: any) => applicationIdOf(row) === selectedId);
  const application = detail.data?.data?.application || detail.data?.data || listRow;

  const approve = useApproveCreatorApplication();
  const reject = useRejectCreatorApplication();

  const open = (row: any, next: "view" | "approve" | "reject") => {
    setSelectedId(applicationIdOf(row));
    setMode(next);
    setNotes("");
    setReason("");
  };

  const close = () => {
    setSelectedId(null);
    setMode("view");
  };

  const onApprove = async () => {
    if (!selectedId) return;
    try {
      const res = await approve.mutateAsync({ id: selectedId, notes });
      const data = res?.data || {};
      setCredentials({
        email: data.adminUser?.email || application?.email,
        name: data.adminUser?.name || application?.fullName,
        temporaryPassword: data.temporaryPassword,
        emailSent: data.emailSent,
      });
      toast({ title: "Creator approved", description: res?.message });
      close();
    } catch (err: any) {
      toast({ title: "Could not approve", description: err?.message, variant: "destructive" });
    }
  };

  const onReject = async () => {
    if (!selectedId || !reason.trim()) return;
    try {
      const res = await reject.mutateAsync({ id: selectedId, rejectionReason: reason.trim() });
      toast({ title: "Application rejected", description: res?.message });
      close();
    } catch (err: any) {
      toast({ title: "Could not reject", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>/</span><span className="text-foreground font-medium">Creator Applications</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Creator applications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review filmmakers who want to upload movies and web series. Approving creates a creator login. This queue is separate from the Partner Program.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = counts?.[tab.id];
          const active = status === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setStatus(tab.id); setPage(1); }}
              className={`px-3 h-9 rounded-lg text-sm font-semibold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
            >
              {tab.label}{typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            className="pl-9 w-64"
            placeholder="Name, email, channel"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No applications</TableCell></TableRow>
            ) : rows.map((row: any) => (
              <TableRow key={applicationIdOf(row)}>
                <TableCell>
                  <p className="font-semibold">{row.fullName}</p>
                  <p className="text-xs text-muted-foreground">{row.email}{row.phone ? ` · ${row.phone}` : ""}</p>
                </TableCell>
                <TableCell className="text-sm">{row.channelName || "—"}</TableCell>
                <TableCell className="text-xs capitalize">{(row.contentTypes || []).join(", ") || "—"}</TableCell>
                <TableCell className="text-sm">{fmtDateTime(row.submittedAt || row.createdAt)}</TableCell>
                <TableCell>
                  <StatusBadge s={row.status} />
                  {row.rejectionReason && <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px] truncate">{row.rejectionReason}</p>}
                </TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => open(row, "view")}>View</Button>
                  {["pending", "under_review"].includes(row.status) && (
                    <>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => open(row, "approve")}>
                        <Check className="w-3.5 h-3.5 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-500" onClick={() => open(row, "reject")}>
                        <X className="w-3.5 h-3.5 mr-1" />Reject
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>{page} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "approve" ? "Approve creator" : mode === "reject" ? "Reject application" : "Application"}
              {application?.fullName ? ` — ${application.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detail.isLoading && !application ? (
            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : application && mode === "view" && (
            <div className="space-y-4">
              <ApplicationDetail application={application} />
              <ApprovedCreatorRate application={application} />
            </div>
          )}
          {mode === "approve" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This creates a creator account for {application?.email}. They can open the creator panel as soon as they sign in, including Revenue. Those sections come with the creator role, so you do not pick them here. The temporary password is shown once after approval so you can share it if email is not configured.
              </p>
              <DefaultRateOnApproval />
              <div>
                <Label>Internal notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to admins only" />
              </div>
            </div>
          )}
          {mode === "reject" && (
            <div>
              <Label>Reason shown to the applicant *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell them what was missing or why this was declined" />
            </div>
          )}
          <DialogFooter className="gap-2">
            {mode === "view" && application && ["pending", "under_review"].includes(application.status) && (
              <>
                <Button variant="outline" onClick={() => setMode("reject")}>Reject…</Button>
                <Button onClick={() => setMode("approve")}>Approve…</Button>
              </>
            )}
            {mode === "approve" && (
              <Button disabled={approve.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApprove}>
                {approve.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Approve and create login
              </Button>
            )}
            {mode === "reject" && (
              <Button disabled={reject.isPending || !reason.trim()} variant="destructive" onClick={onReject}>
                {reject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reject application
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creator login created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {credentials?.emailSent
              ? "A welcome email with these credentials was sent."
              : "The welcome email was not sent. Copy the temporary password and share it with the creator manually."}
          </p>
          <CredentialRow label="Email" value={credentials?.email} />
          <CredentialRow label="Temporary password" value={credentials?.temporaryPassword} secret />
          <p className="text-xs text-muted-foreground">They must change this password the first time they sign in at /admin/login. This password will not be shown again.</p>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function creatorIdFrom(application: any) {
  const ref = application?.adminUserId;
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  return String(ref.id || ref._id || "");
}

function DefaultRateOnApproval() {
  const { data: me } = useGetMe();
  const canView = canViewCreatorRevenueAdmin(me);
  const rate = useDefaultCreatorRate(canView);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Starting watch-hour rate</p>
      {canView && rate.isLoading ? (
        <p className="mt-1 text-muted-foreground">Loading the current default…</p>
      ) : canView && rate.data?.data ? (
        <p className="mt-1 text-muted-foreground">
          This creator starts at {formatRate(rate.data.data.rateInrPerHour)}, the current global default. Approval does not copy a personal rate. Later default changes still apply until someone sets an override, and only to watch time credited after the change.
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          A new creator starts on the global default watch-hour rate. Approval does not set a personal rate.
        </p>
      )}
    </div>
  );
}

function ApprovedCreatorRate({ application }: { application: any }) {
  const { data: me } = useGetMe();
  const canView = canViewCreatorRevenueAdmin(me);
  const canProfile = canViewCreatorProfile(me);
  const creatorId = creatorIdFrom(application);
  const enabled = canView && application?.status === "approved" && !!creatorId;
  const rate = useCreatorRate(creatorId, enabled);
  if (!enabled && !(canProfile && application?.status === "approved" && creatorId)) return null;
  const payload = rate.data?.data;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Watch-hour rate</p>
        {payload && <SourceBadge source={payload.source} />}
      </div>
      {rate.isLoading ? (
        <p className="mt-1 text-muted-foreground">Loading this creator&apos;s rate…</p>
      ) : rate.isError ? (
        <p className="mt-1 text-muted-foreground">The rate could not be loaded.</p>
      ) : payload ? (
        <p className="mt-1 text-muted-foreground">
          {formatRate(payload.rateInrPerHour)}. The global default is {formatRate(payload.defaultRate.rateInrPerHour)}.{" "}
          <Link href="/creator-revenue" className="text-primary underline-offset-2 hover:underline">Open Creator Revenue</Link>
        </p>
      ) : null}
      {canProfile && creatorId && (
        <p className="mt-2">
          <Link href={`/creators/${creatorId}`} className="text-primary underline-offset-2 hover:underline">Open creator profile</Link>
        </p>
      )}
    </div>
  );
}

function ApplicationDetail({ application }: { application: any }) {
  const links: string[] = application.sampleLinks || [];
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {[
        ["Email", application.email],
        ["Phone", application.phone],
        ["City / State", [application.city, application.state].filter(Boolean).join(", ")],
        ["Channel", application.channelName],
        ["Content", (application.contentTypes || []).join(", ")],
        ["Submitted", fmtDateTime(application.submittedAt || application.createdAt)],
        ["Reviewed", fmtDateTime(application.reviewedAt)],
      ].map(([k, v]) => (
        <div key={k}>
          <p className="text-xs text-muted-foreground">{k}</p>
          <p className="font-medium break-words">{v || "—"}</p>
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-2">
        <ShieldCheck className={`w-4 h-4 ${application.copyrightAttested ? "text-emerald-500" : "text-muted-foreground"}`} />
        <span>{application.copyrightAttested ? "Copyright ownership attested" : "Copyright was not attested"}</span>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground">Portfolio</p>
        <p className="whitespace-pre-wrap">{application.portfolioSummary || "—"}</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground">Sample links</p>
        {links.length ? links.map((link) => (
          <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-500 text-sm truncate">
            {link}<ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )) : <p>—</p>}
      </div>
      {application.rejectionReason && (
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Rejection reason</p>
          <p>{application.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

function CredentialRow({ label, value, secret }: { label: string; value?: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2 mt-1">
        <p className={`font-mono text-sm break-all ${secret ? "font-bold" : ""}`}>{value || "—"}</p>
        {value && (
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Clock, ExternalLink, Handshake, IndianRupee, Loader2, Search, Users, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fmtDate, inr, useAdminPartnerApplications, useAdminPartnerCommissions, useAdminPartnerOverview, useAdminPartnerPayouts,
  useAdminPartners, useAdminPartnerSettings, useProcessPayout, useReverseCommission, useReviewApplication, useUpdatePartnerSettings, downloadTdsReport, currentFy,
} from "@/lib/partner-api";

const BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500", under_review: "bg-sky-500/15 text-sky-500", approved: "bg-emerald-500/15 text-emerald-500",
  rejected: "bg-rose-500/15 text-rose-500", active: "bg-emerald-500/15 text-emerald-500", suspended: "bg-rose-500/15 text-rose-500",
  paid: "bg-sky-500/15 text-sky-500", reversed: "bg-rose-500/15 text-rose-500", requested: "bg-amber-500/15 text-amber-500",
};
export const StatusBadge = ({ s }: { s: string }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${BADGE[s] || "bg-muted text-muted-foreground"}`}>{s?.replace("_", " ")}</span>
);
const Empty = ({ cols, loading }: { cols: number; loading?: boolean }) => (
  <TableRow><TableCell colSpan={cols} className="text-center py-10 text-muted-foreground">{loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "No records"}</TableCell></TableRow>
);
const Pager = ({ p, page, setPage }: any) =>
  p && p.totalPages > 1 ? (
    <div className="flex items-center justify-end gap-2 pt-3 text-sm text-muted-foreground">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
      <span>{page} / {p.totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= p.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
    </div>
  ) : null;

export default function AdminPartnersPage() {
  const ov = useAdminPartnerOverview().data?.data;
  const pendingApps = (ov?.applications?.pending || 0) + (ov?.applications?.under_review || 0);
  const stats = [
    { label: "Applications to review", value: pendingApps, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Active partners", value: ov?.activePartners ?? "—", icon: Handshake, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Referred users", value: ov?.referredUsers?.toLocaleString("en-IN") ?? "—", icon: Users, color: "text-sky-500", bg: "bg-sky-500/10" },
    { label: "Partner revenue", value: inr(ov?.revenue), icon: IndianRupee, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Commission owed", value: inr((ov?.commission?.approved || 0) + (ov?.commission?.pending || 0), 2), icon: Wallet, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Payout requests", value: `${ov?.payoutsRequested?.count ?? 0} · ${inr(ov?.payoutsRequested?.amount, 2)}`, icon: Wallet, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
        <span className="text-muted-foreground/60">Dashboard</span><span>/</span><span className="text-foreground font-medium">Partner Program</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
            <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="text-lg font-black text-foreground">{s.value}</p></div>
          </div>
        ))}
      </div>
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications{pendingApps ? ` (${pendingApps})` : ""}</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts{ov?.payoutsRequested?.count ? ` (${ov.payoutsRequested.count})` : ""}</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="mt-4"><ApplicationsTab /></TabsContent>
        <TabsContent value="partners" className="mt-4"><PartnersTab /></TabsContent>
        <TabsContent value="commissions" className="mt-4"><CommissionsTab /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Applications ── */
function ApplicationsTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminPartnerApplications({ status, search, page });
  const review = useReviewApplication();
  const [sel, setSel] = useState<any>(null);
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [form, setForm] = useState<any>({});

  const open = (a: any, m: "view" | "approve" | "reject") => { setSel(a); setMode(m); setForm({ code: "", commissionRate: "", couponCode: "", reason: "" }); };
  const act = async (action: string, extra: any = {}) => {
    try {
      await review.mutateAsync({ id: sel._id, action, ...extra });
      toast({ title: action === "approve" ? "Partner approved" : action === "reject" ? "Application rejected" : "Marked under review" });
      setSel(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">To review</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="under_review">Under review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9 w-64" placeholder="Name, email, phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Location</TableHead><TableHead>Channels</TableHead><TableHead>Audience</TableHead><TableHead>Applied</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {!(q.data?.data || []).length ? <Empty cols={7} loading={q.isLoading} /> : q.data.data.map((a: any) => {
              const overdue = ["pending", "under_review"].includes(a.status) && Date.now() - new Date(a.createdAt).getTime() > 20 * 3600000;
              return (
                <TableRow key={a._id}>
                  <TableCell><p className="font-semibold">{a.fullName}</p><p className="text-xs text-muted-foreground">{a.email} · {a.phone}</p></TableCell>
                  <TableCell className="text-sm">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs capitalize">{(a.promotionChannels || []).join(", ")}</TableCell>
                  <TableCell className="text-sm">{a.audienceSize || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(a.createdAt)}{overdue && <span className="block text-[11px] text-rose-500 font-semibold">SLA &lt; 4h left</span>}</TableCell>
                  <TableCell><StatusBadge s={a.status} />{a.rejectionReason && <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px] truncate">{a.rejectionReason}</p>}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => open(a, "view")}>View</Button>
                    {["pending", "under_review"].includes(a.status) && <>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => open(a, "approve")}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" className="text-rose-500" onClick={() => open(a, "reject")}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
                    </>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pager p={q.data?.pagination} page={page} setPage={setPage} />

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{mode === "approve" ? "Approve partner" : mode === "reject" ? "Reject application" : "Application"} — {sel?.fullName}</DialogTitle></DialogHeader>
          {sel && mode === "view" && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Email", sel.email], ["Phone", sel.phone], ["City / State", [sel.city, sel.state].filter(Boolean).join(", ")], ["Audience", sel.audienceSize],
                ["Channels", (sel.promotionChannels || []).join(", ")], ["PAN", sel.pan || "—"],
                ["Payout", sel.payoutMethod === "upi" ? `UPI: ${sel.upiId}` : `Bank: ${sel.bankAccountName} · XXXX${String(sel.bankAccountNumber || "").slice(-4)} · ${sel.ifsc}`],
                ["Applied", fmtDate(sel.createdAt)],
              ].map(([k, v]) => <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium break-words">{v || "—"}</p></div>)}
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Links</p>{(sel.socialLinks || []).length ? sel.socialLinks.map((l: string) => <a key={l} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-500 text-sm truncate">{l}<ExternalLink className="w-3 h-3" /></a>) : "—"}</div>
              {sel.promotionDetails && <div className="col-span-2"><p className="text-xs text-muted-foreground">Promotion plan</p><p>{sel.promotionDetails}</p></div>}
            </div>
          )}
          {mode === "approve" && (
            <div className="space-y-3">
              <div><Label>Partner code (optional)</Label><Input placeholder="Auto-generate" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
              <div><Label>Commission rate % (optional)</Label><Input type="number" placeholder="Program default" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></div>
              <div><Label>Coupon code (optional)</Label><Input placeholder="e.g. RIYA10" value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} /></div>
              <p className="text-xs text-muted-foreground">The applicant gets an approval email and their dashboard unlocks immediately.</p>
            </div>
          )}
          {mode === "reject" && (
            <div><Label>Reason (shown to the applicant) *</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Social profile links could not be verified" /></div>
          )}
          <DialogFooter className="gap-2">
            {mode === "view" && sel?.status === "pending" && <Button variant="outline" onClick={() => act("review")}>Mark under review</Button>}
            {mode === "view" && ["pending", "under_review"].includes(sel?.status) && <Button onClick={() => setMode("approve")}>Approve…</Button>}
            {mode === "approve" && <Button disabled={review.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => act("approve", { code: form.code || undefined, commissionRate: form.commissionRate === "" ? undefined : Number(form.commissionRate), couponCode: form.couponCode || undefined })}>Approve partner</Button>}
            {mode === "reject" && <Button disabled={review.isPending || !form.reason.trim()} variant="destructive" onClick={() => act("reject", { reason: form.reason })}>Reject</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Partners ── */
function PartnersTab() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminPartners({ status, search, page });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9 w-64" placeholder="Name, code, email" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Code</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Referred</TableHead><TableHead className="text-right">Paying</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Earned</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {!(q.data?.data || []).length ? <Empty cols={9} loading={q.isLoading} /> : q.data.data.map((p: any) => (
              <TableRow key={p._id} className="cursor-pointer" onClick={() => setLocation(`/partners/${p._id}`)}>
                <TableCell><p className="font-semibold">{p.displayName}</p><p className="text-xs text-muted-foreground">{p.email}</p></TableCell>
                <TableCell className="font-mono font-semibold">{p.code}</TableCell>
                <TableCell>{p.effectiveRate}%{p.commissionRate == null && <span className="text-[10px] text-muted-foreground ml-1">default</span>}</TableCell>
                <TableCell className="text-right">{p.usersReferred}</TableCell>
                <TableCell className="text-right">{p.payingUsers}</TableCell>
                <TableCell className="text-right">{inr(p.revenue, 2)}</TableCell>
                <TableCell className="text-right font-semibold">{inr(p.commissionEarned, 2)}</TableCell>
                <TableCell className="text-right">{inr(p.commissionPaid, 2)}</TableCell>
                <TableCell><StatusBadge s={p.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager p={q.data?.pagination} page={page} setPage={setPage} />
    </div>
  );
}

/* ── Commissions ── */
export function CommissionsTab({ partnerId }: { partnerId?: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const q = useAdminPartnerCommissions({ status, partnerId, page });
  const reverse = useReverseCommission();
  const onReverse = async (c: any) => {
    const reason = window.prompt(`Reverse ${inr(c.amount, 2)} commission? Enter reason (e.g. refund, fraud):`, "Refund");
    if (!reason) return;
    try { await reverse.mutateAsync({ id: c.id, reason }); toast({ title: c.status === "paid" ? "Reversed — clawback will be deducted from next payout" : "Commission reversed" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };
  return (
    <div className="space-y-3">
      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{["all", "pending", "approved", "paid", "reversed"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead>{!partnerId && <TableHead>Partner</TableHead>}<TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Sale</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {!(q.data?.data || []).length ? <Empty cols={9} loading={q.isLoading} /> : q.data.data.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm">{fmtDate(c.createdAt)}</TableCell>
                {!partnerId && <TableCell className="font-mono text-xs">{c.partner?.code}</TableCell>}
                <TableCell><p className="text-sm">{c.user?.name || "—"}</p><p className="text-[11px] text-muted-foreground">{c.user?.email}</p></TableCell>
                <TableCell className="text-sm">{c.planName}{c.isRenewal && <span className="ml-1 text-[10px] text-sky-500">renewal</span>}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{c.paymentId}</TableCell>
                <TableCell className="text-right">{inr(c.saleAmount, 2)}</TableCell>
                <TableCell className="text-right font-semibold">{inr(c.amount, 2)} <span className="text-[10px] text-muted-foreground">{c.rate}%</span></TableCell>
                <TableCell><StatusBadge s={c.status} />{c.status === "pending" && <p className="text-[10px] text-muted-foreground">until {fmtDate(c.holdUntil)}</p>}{c.reversalReason && <p className="text-[10px] text-muted-foreground">{c.reversalReason}</p>}</TableCell>
                <TableCell>{c.status !== "reversed" && <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => onReverse(c)}>Reverse</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager p={q.data?.pagination} page={page} setPage={setPage} />
    </div>
  );
}

/* ── Payouts ── */
export function PayoutsTab({ partnerId }: { partnerId?: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState("all");
  const [fy, setFy] = useState(currentFy());
  const fyOpts = (() => { const y = Number(currentFy().slice(0, 4)); return [0, 1, 2].map((d) => `${y - d}-${String((y - d + 1) % 100).padStart(2, "0")}`); })();
  const exportTds = async () => { try { await downloadTdsReport(fy); } catch (e: any) { toast({ title: "Export failed", description: e?.message, variant: "destructive" }); } };
  const q = useAdminPartnerPayouts({ status, partnerId });
  const process = useProcessPayout();
  const [sel, setSel] = useState<any>(null);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const submit = async (action: "paid" | "reject") => {
    try { await process.mutateAsync({ id: sel._id, action, reference: ref, note }); toast({ title: action === "paid" ? "Payout marked paid" : "Payout rejected" }); setSel(null); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{["all", "requested", "paid", "rejected"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
      {!partnerId && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">TDS report FY</span>
          <Select value={fy} onValueChange={setFy}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{fyOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" onClick={exportTds}>Export TDS CSV</Button>
        </div>
      )}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Requested</TableHead>{!partnerId && <TableHead>Partner</TableHead>}<TableHead className="text-right">Gross</TableHead><TableHead className="text-right">TDS</TableHead><TableHead className="text-right">Net payable</TableHead><TableHead>Pay to</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead><TableHead>Processed</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {!(q.data?.data || []).length ? <Empty cols={10} loading={q.isLoading} /> : q.data.data.map((x: any) => (
              <TableRow key={x._id}>
                <TableCell className="text-sm">{fmtDate(x.createdAt)}</TableCell>
                {!partnerId && <TableCell><p className="text-sm font-semibold">{x.partnerId?.displayName}</p><p className="font-mono text-[11px] text-muted-foreground">{x.partnerId?.code}</p></TableCell>}
                <TableCell className="text-right font-semibold">{inr(x.amount, 2)}{x.clawbackDeducted > 0 && <p className="text-[10px] text-rose-500">−{inr(x.clawbackDeducted, 2)} clawback</p>}</TableCell>
                <TableCell className="text-right text-sm text-rose-500">{x.tdsAmount > 0 ? `−${inr(x.tdsAmount, 2)}` : "—"}{x.tdsRate > 0 && x.tdsAmount > 0 && <p className="text-[10px] text-muted-foreground">{x.tdsRate}% · FY {x.financialYear}</p>}</TableCell>
                <TableCell className="text-right font-bold text-emerald-500">{inr(x.netAmount ?? x.amount, 2)}{x.status === "requested" && !x.pan && !x.partnerId?.pan && <p className="text-[10px] text-rose-500 font-semibold">no PAN</p>}</TableCell>
                <TableCell className="text-sm">{x.method?.toUpperCase()} · {x.status === "requested" && x.partnerId?.upiId ? x.partnerId.upiId : x.destination}</TableCell>
                <TableCell><StatusBadge s={x.status} /></TableCell>
                <TableCell className="font-mono text-xs">{x.reference || x.adminNote || "—"}</TableCell>
                <TableCell className="text-sm">{fmtDate(x.processedAt)}</TableCell>
                <TableCell>{x.status === "requested" && <Button size="sm" onClick={() => { setSel(x); setRef(""); setNote(""); }}>Process</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process payout — net {inr(sel?.netAmount ?? sel?.amount, 2)}</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross commission</span><span>{inr(sel?.amount, 2)}</span></div>
            <div className="flex justify-between text-rose-500"><span>TDS {sel?.tdsRate || 0}% {sel?.tdsSection ? `(${sel.tdsSection})` : ""}</span><span>−{inr(sel?.tdsAmount || 0, 2)}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Net to transfer</span><span>{inr(sel?.netAmount ?? sel?.amount, 2)}</span></div>
            <p className="text-[11px] text-muted-foreground">PAN {sel?.pan || "—"} · FY {sel?.financialYear || "—"}. TDS is recomputed when marked paid.</p>
          </div>
          <p className="text-sm text-muted-foreground">Transfer the amount manually (UPI / NEFT), then record the UTR / transaction reference here.</p>
          <div className="space-y-3">
            <div><Label>Transaction reference (UTR) *</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
            <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional; required context if rejecting" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-rose-500" disabled={process.isPending} onClick={() => submit("reject")}>Reject</Button>
            <Button disabled={process.isPending || !ref.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => submit("paid")}>Mark as paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Settings ── */
function SettingsTab() {
  const { toast } = useToast();
  const q = useAdminPartnerSettings();
  const save = useUpdatePartnerSettings();
  const [f, setF] = useState<any>(null);
  const s = f || q.data?.data;
  if (!s) return <Loader2 className="w-5 h-5 animate-spin" />;
  const set = (k: string, v: any) => setF({ ...s, [k]: v });
  const onSave = async () => {
    try {
      const { _id, __v, createdAt, updatedAt, ...body } = s;
      await save.mutateAsync(body);
      toast({ title: "Partner program settings saved" });
      setF(null);
    } catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };
  const num = (k: string, l: string, hint: string) => (
    <div><Label>{l}</Label><Input type="number" value={s[k]} onChange={(e) => set(k, e.target.value)} /><p className="text-xs text-muted-foreground mt-1">{hint}</p></div>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between"><div><p className="font-semibold">Program enabled</p><p className="text-xs text-muted-foreground">When off, new applications are blocked; existing referrals still earn.</p></div><Switch checked={!!s.enabled} onCheckedChange={(v) => set("enabled", v)} /></div>
      <div className="grid sm:grid-cols-2 gap-5">
        {num("defaultCommissionRate", "Default commission %", "Override per partner on their detail page.")}
        {num("holdDays", "Hold period (days)", "Pending → approved after this (refund protection).")}
        {num("minPayout", "Minimum payout (₹)", "Partners can request a payout above this.")}
        {num("attributionWindowDays", "Code entry window (days)", "How long after signup a user can enter a partner code.")}
        {num("reviewSlaHours", "Review SLA (hours)", "Shown to applicants: “approved within N hours”.")}
        <div><Label>Commission base</Label>
          <Select value={s.commissionBase} onValueChange={(v) => set("commissionBase", v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="gross">Gross (amount paid incl. GST, after discount)</SelectItem><SelectItem value="net">Net (excluding GST)</SelectItem></SelectContent></Select>
          <p className="text-xs text-muted-foreground mt-1">10% of ₹1,062 paid = ₹106.20.</p></div>
      </div>
      <div className="flex items-center justify-between"><div><p className="font-semibold">Pay commission on renewals</p><p className="text-xs text-muted-foreground">If off, only a referred user’s first purchase earns commission.</p></div><Switch checked={!!s.commissionOnRenewals} onCheckedChange={(v) => set("commissionOnRenewals", v)} /></div>
      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex items-center justify-between"><div><p className="font-semibold">Buyer discount via partner code</p><p className="text-xs text-muted-foreground">Referred / code-entering buyers get this % off; applied server-side to the Razorpay amount. Per-partner override on the partner page (0 = off).</p></div><Switch checked={!!s.buyerDiscountEnabled} onCheckedChange={(v) => set("buyerDiscountEnabled", v)} /></div>
        <div className="grid sm:grid-cols-2 gap-5">{num("buyerDiscountPercent", "Default buyer discount %", "Max 90%.")}</div>
        <div className="flex items-center justify-between"><div><p className="font-semibold">Discount on renewals</p><p className="text-xs text-muted-foreground">Off = first purchase only.</p></div><Switch checked={!!s.discountOnRenewals} onCheckedChange={(v) => set("discountOnRenewals", v)} /></div>
      </div>
      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex items-center justify-between"><div><p className="font-semibold">Deduct TDS on payouts</p><p className="text-xs text-muted-foreground">Commission TDS ({s.tdsSection || "s.393(1) IT Act 2025, old 194H"}). PAN required before first payout.</p></div><Switch checked={!!s.tdsEnabled} onCheckedChange={(v) => set("tdsEnabled", v)} /></div>
        <div className="grid sm:grid-cols-2 gap-5">
          {num("tdsRate", "TDS rate %", "2% from 1 Oct 2024.")}
          {num("tdsThresholdPerFY", "Threshold per FY (₹)", "₹20,000 from 1 Apr 2025. Once crossed, TDS applies to the whole FY amount.")}
        </div>
      </div>
      <div><Label>Partner terms URL</Label><Input value={s.termsUrl || ""} onChange={(e) => set("termsUrl", e.target.value)} placeholder="/page/partner-terms" /></div>
      <Button onClick={onSave} disabled={save.isPending || !f}>Save settings</Button>
    </div>
  );
}

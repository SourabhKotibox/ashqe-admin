import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Copy, IndianRupee, Loader2, Percent, Users, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, inr, useAdminPartner, useUpdatePartner } from "@/lib/partner-api";
import { CommissionsTab, PayoutsTab, StatusBadge } from "./admin-partners";

export default function AdminPartnerDetailPage() {
  const [, params] = useRoute("/partners/:id");
  const id = (params as { id?: string } | null)?.id;
  const { toast } = useToast();
  const q = useAdminPartner(id);
  const update = useUpdatePartner();
  const d = q.data?.data;
  const p = d?.partner;
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (p) setF({ code: p.code, commissionRate: p.commissionRate ?? "", couponCode: p.couponCode || "", couponDiscountPercent: p.couponDiscountPercent ?? "", status: p.status, notes: p.notes || "" });
  }, [p?._id, p?.updatedAt]);

  if (q.isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (!p) return <p className="text-muted-foreground">Partner not found.</p>;
  const s = d.stats;

  const save = async () => {
    try { await update.mutateAsync({ id, ...f }); toast({ title: "Partner updated" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };
  const cards = [
    { label: "Users referred", value: s.usersReferred, sub: `${s.payingUsers} paying · ${s.conversionRate}% conv.`, icon: Users, c: "text-sky-500", bg: "bg-sky-500/10" },
    { label: "Revenue generated", value: inr(s.revenueGenerated, 2), sub: `${s.salesCount} sales`, icon: IndianRupee, c: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Commission earned", value: inr(s.commission.earned, 2), sub: `${inr(s.commission.pending, 2)} on hold`, icon: Percent, c: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Paid out", value: inr(s.commission.paid, 2), sub: `${inr(s.availableBalance, 2)} available`, icon: Wallet, c: "text-amber-500", bg: "bg-amber-500/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
        <Link href="/partners" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-4 h-4" />Partners</Link><span>/</span>
        <span className="text-foreground font-medium">{p.displayName}</span>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center gap-6 justify-between">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-xl font-black">{p.displayName}</h1><StatusBadge s={p.status} /></div>
          <p className="text-sm text-muted-foreground">{p.email} · {p.phone} · partner since {fmtDate(p.approvedAt || p.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold px-3 py-1 rounded-lg bg-muted">{p.code}</span>
          <span className="text-sm font-semibold">{p.effectiveRate}%</span>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(p.shareLink); toast({ title: "Link copied" }); }}><Copy className="w-3.5 h-3.5 mr-1" />Share link</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-4 w-4 ${c.c}`} /></div>
            <div><p className="text-xs text-muted-foreground">{c.label}</p><p className="text-lg font-black">{c.value}</p><p className="text-[11px] text-muted-foreground">{c.sub}</p></div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <p className="font-semibold mb-3">Last 30 days — revenue & commission</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => inr(v, 2)} />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#8b5cf633" name="Revenue" />
                <Area type="monotone" dataKey="commission" stroke="#10b981" fill="#10b98133" name="Commission" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="font-semibold">Partner settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={f.code || ""} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></div>
            <div><Label>Rate % (blank = default)</Label><Input type="number" value={f.commissionRate} onChange={(e) => setF({ ...f, commissionRate: e.target.value })} /></div>
            <div><Label>Coupon</Label><Input value={f.couponCode || ""} onChange={(e) => setF({ ...f, couponCode: e.target.value.toUpperCase() })} /></div>
            <div><Label>Coupon %</Label><Input type="number" value={f.couponDiscountPercent} onChange={(e) => setF({ ...f, couponDiscountPercent: e.target.value })} /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
          <div><Label>Internal notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Pays to: {p.payoutMethod === "upi" ? `UPI ${p.upiId || "—"}` : `Bank ${p.bankAccountName || ""} ${p.bankAccountNumber ? "XXXX" + String(p.bankAccountNumber).slice(-4) : ""} ${p.ifsc || ""}`}{p.pan ? ` · PAN ${p.pan}` : " · no PAN"}</p>
          <Button className="w-full" disabled={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
      <Tabs defaultValue="referred">
        <TabsList><TabsTrigger value="referred">Referred users ({s.usersReferred})</TabsTrigger><TabsTrigger value="commissions">Commissions</TabsTrigger><TabsTrigger value="payouts">Payouts</TabsTrigger></TabsList>
        <TabsContent value="referred" className="mt-4">
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Phone</TableHead><TableHead>Joined via</TableHead><TableHead>Referred on</TableHead><TableHead>Subscription</TableHead></TableRow></TableHeader>
              <TableBody>
                {(d.referredUsers || []).map((u: any) => (
                  <TableRow key={u._id}>
                    <TableCell><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{(u.referralSource || "").replace("_", " ") || "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(u.referredAt)}</TableCell>
                    <TableCell className="text-sm">{u.subscriptionStatus === "active" ? <span className="text-emerald-500 font-semibold">{u.subscriptionPlanName || "Active"}</span> : <span className="text-muted-foreground">Free</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="commissions" className="mt-4"><CommissionsTab partnerId={id} /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab partnerId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}

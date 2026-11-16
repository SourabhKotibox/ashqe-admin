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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, inr, useAdminPartner, useUpdatePartner, useCreateDirectPayout } from "@/lib/partner-api";
import { CommissionsTab, PayoutsTab, StatusBadge } from "./admin-partners";

export default function AdminPartnerDetailPage() {
  const [, params] = useRoute("/partners/:id");
  const id = (params as { id?: string } | null)?.id;
  const { toast } = useToast();
  const q = useAdminPartner(id);
  const update = useUpdatePartner();
  const createPayout = useCreateDirectPayout();
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("phonepe");
  const d = q.data?.data;
  const p = d?.partner;
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (p) setF({ code: p.code, commissionRate: p.commissionRate ?? "", couponCode: p.couponCode || "", couponDiscountPercent: p.couponDiscountPercent ?? "", status: p.status, notes: p.notes || "", pan: p.pan || "" });
  }, [p?._id, p?.updatedAt]);

  if (q.isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (!p) return <p className="text-muted-foreground">Partner not found.</p>;
  const s = d.stats;

  const save = async () => {
    try { const body: any = { ...f, couponDiscountPercent: f.couponDiscountPercent === "" ? null : Number(f.couponDiscountPercent) }; if (!body.pan) delete body.pan; await update.mutateAsync({ id, ...body }); toast({ title: "Partner updated" }); }
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
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => {
            const unpaid = Math.max(0, (s.commission.earned || 0) - (s.commission.paid || 0));
            setPayAmount(unpaid > 0 ? String(unpaid) : "");
            setPayRef("");
            setPayNote("");
            setPayDialogOpen(true);
          }}>
            <Wallet className="w-3.5 h-3.5 mr-1" />Pay Commission
          </Button>
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
            <div><Label>Buyer discount % (blank = default, 0 = off)</Label><Input type="number" value={f.couponDiscountPercent} onChange={(e) => setF({ ...f, couponDiscountPercent: e.target.value })} /></div>
          </div>
          <div><Label>PAN (required before payout)</Label><Input value={f.pan || ""} maxLength={10} placeholder="AAAAA9999A" onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} /></div>
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

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Partner Commission — {p.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Payment Method *</Label>
              <Select value={payMethod} onValueChange={(val) => {
                setPayMethod(val);
                if (val === "cash" && !payRef) setPayRef("Cash in hand");
                else if (val === "phonepe" && !payRef) setPayRef("PhonePe Transfer");
                else if (val === "gpay" && !payRef) setPayRef("GPay Transfer");
                else if (val === "paytm" && !payRef) setPayRef("Paytm Transfer");
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phonepe">📱 PhonePe</SelectItem>
                  <SelectItem value="cash">💵 Cash (Hand-to-Hand / Offline)</SelectItem>
                  <SelectItem value="gpay">📱 Google Pay (GPay)</SelectItem>
                  <SelectItem value="paytm">📱 Paytm</SelectItem>
                  <SelectItem value="upi">⚡ General UPI</SelectItem>
                  <SelectItem value="bank">🏦 Bank Account (NEFT / IMPS)</SelectItem>
                  <SelectItem value="other">📝 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
              <p className="font-bold text-foreground text-sm">Recipient Details for Selected Method</p>
              {payMethod === "cash" ? (
                <p className="text-emerald-400 font-semibold">
                  💵 Cash Payment: Pay directly in cash (in-person) to {p.displayName}. No online transfer needed.
                </p>
              ) : payMethod === "phonepe" || payMethod === "gpay" || payMethod === "paytm" ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mobile Number: <span className="font-mono font-bold text-foreground">{p.phone || "Not set"}</span></span>
                    {p.phone && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { navigator.clipboard?.writeText(p.phone); toast({ title: "Mobile number copied" }); }}>
                        <Copy className="w-3 h-3 mr-1" />Copy
                      </Button>
                    )}
                  </div>
                  {p.upiId && <p className="text-muted-foreground">Registered UPI: <span className="font-mono text-foreground">{p.upiId}</span></p>}
                </div>
              ) : payMethod === "bank" ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Bank A/C: <span className="font-mono font-bold text-foreground">{p.bankAccountNumber || "—"}</span></p>
                  <p className="text-muted-foreground">IFSC: <span className="font-mono font-bold text-foreground">{p.ifsc || "—"}</span></p>
                  <p className="text-muted-foreground">Holder: <span className="font-bold text-foreground">{p.bankAccountName || "—"}</span></p>
                  {p.bankAccountNumber && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs mt-1" onClick={() => { navigator.clipboard?.writeText(`${p.bankAccountNumber} ${p.ifsc}`); toast({ title: "Bank details copied" }); }}>
                      <Copy className="w-3 h-3 mr-1" />Copy
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">UPI ID: <span className="font-mono font-bold text-foreground">{p.upiId || "Not set"}</span></span>
                  {p.upiId && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { navigator.clipboard?.writeText(p.upiId); toast({ title: "UPI ID copied" }); }}>
                      <Copy className="w-3 h-3 mr-1" />Copy
                    </Button>
                  )}
                </div>
              )}
              {p.pan && <p className="text-muted-foreground">PAN: <span className="font-mono text-foreground">{p.pan}</span></p>}
            </div>

            <div className="flex justify-between items-center text-sm border-t border-b border-border py-2">
              <span className="text-muted-foreground">Unpaid Commission Owed:</span>
              <span className="font-bold text-emerald-500 text-base">{inr(Math.max(0, (s.commission.earned || 0) - (s.commission.paid || 0)), 2)}</span>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Amount to Pay (₹) *</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label>{payMethod === "cash" ? "Receipt Note / Reference" : "Payment Reference (UTR / Transfer ID) *"}</Label>
                <Input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder={payMethod === "cash" ? "e.g. Cash in hand or Receipt #" : "e.g. PhonePe UTR / Txn ID"}
                />
              </div>
              <div>
                <Label>Admin Note (Optional)</Label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder={payMethod === "cash" ? "e.g. Paid in cash at office" : "e.g. Paid via PhonePe"}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={createPayout.isPending || !payAmount || Number(payAmount) <= 0}
              onClick={async () => {
                try {
                  const finalRef = payRef.trim() || (payMethod === "cash" ? "Cash in hand" : "Direct Payout");
                  await createPayout.mutateAsync({
                    partnerId: p._id,
                    amount: Number(payAmount),
                    reference: finalRef,
                    paymentMethod: payMethod,
                    note: payNote.trim(),
                  });
                  toast({ title: "Commission Paid", description: `Successfully recorded ${payMethod.toUpperCase()} payout of ₹${payAmount}.` });
                  setPayDialogOpen(false);
                } catch (e: any) {
                  toast({ title: "Failed to record payout", description: e?.message, variant: "destructive" });
                }
              }}
            >
              {createPayout.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, BadgeIndianRupee, Check, CheckCircle2, Clock, Copy, Handshake, IndianRupee, Link2, Loader2,
  Megaphone, Share2, ShieldCheck, TrendingUp, Users, Wallet, XCircle,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PublicHeader, PublicFooter } from "@/pages/streaming-home";
import { useToast } from "@/hooks/use-toast";
import {
  fmtDate, inr, useApplyForPartner, usePartnerCommissions, usePartnerDashboard, usePartnerPayouts,
  usePartnerReferrals, usePartnerStatus, useRequestPayout,
  useSavePartnerPan,
  PAN_REGEX,
} from "@/lib/partner-api";

const card = "bg-white/[0.03] border border-white/10 rounded-2xl";
const input =
  "w-full h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60";
const label = "text-xs font-semibold text-white/60 mb-1.5 block";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paid: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  reversed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  requested: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
const Pill = ({ s }: { s: string }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${STATUS_STYLES[s] || "bg-white/10 text-white/70 border-white/10"}`}>{s}</span>
);

export default function PartnerProgramPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const signedIn = !!(typeof window !== "undefined" && localStorage.getItem("appAccessToken"));

  useEffect(() => {
    try {
      const stored = localStorage.getItem("appUser");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const { data: statusRes, isLoading } = usePartnerStatus(signedIn);
  const status = statusRes?.data;

  const handleSignOut = () => {
    ["appUser", "appAccessToken", "refreshToken", "ott_active_profile"].forEach((k) => localStorage.removeItem(k));
    setLocation("/login");
    window.location.reload();
  };

  let body: JSX.Element;
  if (!signedIn) body = <Landing onCta={() => setLocation("/login?next=/partner-program")} ctaLabel="Sign in to apply" />;
  else if (isLoading) body = <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  else if (status?.isPartner) body = <PartnerDashboard status={status} />;
  else if (status?.application && ["pending", "under_review"].includes(status.application.status)) body = <UnderReview status={status} />;
  else body = <ApplyView status={status} />;

  return (
    <div className="min-h-screen text-foreground flex flex-col bg-[#030306]">
      <PublicHeader
        activeTab="home"
        setActiveTab={(tab) => (tab === "home" ? setLocation("/") : setLocation(`/browse/${tab}`))}
        onSignIn={() => setLocation("/login")}
        onSignOut={handleSignOut}
        user={user}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-28 pb-16">{body}</main>
      <PublicFooter />
    </div>
  );
}

/* ───────────── Landing / pitch ───────────── */
function Landing({ onCta, ctaLabel, compact = false, rate = 10 }: { onCta?: () => void; ctaLabel?: string; compact?: boolean; rate?: number }) {
  const [sales, setSales] = useState(50000);
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 via-rose-500/5 to-transparent p-8 sm:p-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
            <Handshake className="w-4 h-4" /> Become our partner
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">
            Earn <span className="text-amber-400">{rate}%</span> on every subscription you sell
          </h1>
          <p className="mt-4 text-white/60 text-base sm:text-lg">
            Share your link with your audience. Every time someone you refer buys a plan, you earn {rate}% of it. Track signups, revenue and payouts live on your own dashboard.
          </p>
          {!compact && onCta && (
            <button onClick={onCta} className="mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold">
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Megaphone, t: "1. Apply", d: "Fill a short form. We review it and approve within 24 hours." },
          { icon: Share2, t: "2. Share", d: "Get your own partner code and link. Share it on Instagram, YouTube, WhatsApp, anywhere." },
          { icon: BadgeIndianRupee, t: "3. Earn", d: `Earn ${rate}% of every subscription your referrals buy. Withdraw to UPI or bank.` },
        ].map(({ icon: I, t, d }) => (
          <div key={t} className={`${card} p-6`}>
            <I className="w-6 h-6 text-amber-400" />
            <h3 className="mt-4 font-bold text-white">{t}</h3>
            <p className="mt-1 text-sm text-white/55">{d}</p>
          </div>
        ))}
      </section>

      <section className={`${card} p-6 sm:p-8 grid md:grid-cols-2 gap-8 items-center`}>
        <div>
          <h2 className="text-xl font-bold text-white">Earnings calculator</h2>
          <p className="text-sm text-white/50 mt-1">How much subscription revenue can you bring in a month?</p>
          <input type="range" min={5000} max={500000} step={5000} value={sales} onChange={(e) => setSales(Number(e.target.value))} className="w-full mt-6 accent-amber-400" />
          <div className="flex justify-between text-xs text-white/40 mt-1"><span>₹5k</span><span>₹5L</span></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
            <p className="text-xs text-white/50">Subscriptions sold</p>
            <p className="text-2xl font-black text-white mt-1">{inr(sales)}</p>
          </div>
          <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-5">
            <p className="text-xs text-amber-200/70">You earn ({rate}%)</p>
            <p className="text-2xl font-black text-amber-300 mt-1">{inr((sales * rate) / 100)}</p>
          </div>
        </div>
      </section>

      {!compact && (
        <section className="grid sm:grid-cols-2 gap-4 text-sm text-white/55">
          <div className={`${card} p-5 flex gap-3`}><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /> Commission is confirmed after a 7-day hold (refund protection), then becomes withdrawable. Minimum withdrawal ₹500.</div>
          <div className={`${card} p-5 flex gap-3`}><Link2 className="w-5 h-5 text-sky-400 shrink-0" /> Users count as yours when they sign up through your link, or enter your code within 7 days of signing up.</div>
        </section>
      )}
    </div>
  );
}

/* ───────────── Application form ───────────── */
const CHANNELS = [
  { v: "instagram", l: "Instagram" },
  { v: "youtube", l: "YouTube" },
  { v: "social", l: "Facebook / WhatsApp / Telegram" },
  { v: "offline", l: "Offline / shop / community" },
  { v: "other", l: "Other" },
];

function ApplyView({ status }: { status: any }) {
  const { toast } = useToast();
  const apply = useApplyForPartner();
  const rejected = status?.application?.status === "rejected";
  const [f, setF] = useState<any>({
    fullName: status?.prefill?.fullName || "", email: status?.prefill?.email || "", phone: status?.prefill?.phone || "",
    city: "", state: "", promotionChannels: [] as string[], audienceSize: "", socialLinks: "", promotionDetails: "",
    pan: "", payoutMethod: "upi", upiId: "", bankAccountName: "", bankAccountNumber: "", ifsc: "", agreedToTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const res = await apply.mutateAsync({
        ...f,
        socialLinks: f.socialLinks.split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean),
      });
      toast({ title: "Application submitted", description: res?.message });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      const fe = err?.details?.errors || {};
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]: any) => [k, Array.isArray(v) ? v[0] : String(v)])));
      toast({ title: "Could not submit", description: err?.message, variant: "destructive" });
    }
  };
  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="text-xs text-rose-400 mt-1">{errors[k]}</p> : null);

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8">
      <div><Landing compact rate={status?.defaultCommissionRate ?? 10} /></div>
      <form onSubmit={submit} className={`${card} p-6 sm:p-8 space-y-5 h-fit lg:sticky lg:top-24`}>
        <div>
          <h2 className="text-xl font-bold text-white">Partner application</h2>
          <p className="text-sm text-white/50 mt-1">Takes 2 minutes. We review and approve within {status?.reviewSlaHours ?? 24} hours.</p>
        </div>
        {rejected && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            Your previous application was not approved{status.application.rejectionReason ? `: ${status.application.rejectionReason}` : "."} You can update the details and apply again.
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><span className={label}>Full name *</span><input className={input} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /><Err k="fullName" /></div>
          <div><span className={label}>Mobile *</span><input className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" required /><Err k="phone" /></div>
          <div><span className={label}>Email *</span><input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} required /><Err k="email" /></div>
          <div><span className={label}>City</span><input className={input} value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><span className={label}>State</span><input className={input} value={f.state} onChange={(e) => set("state", e.target.value)} /></div>
        </div>
        <div>
          <span className={label}>Where will you promote? *</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = f.promotionChannels.includes(c.v);
              return (
                <button type="button" key={c.v}
                  onClick={() => set("promotionChannels", on ? f.promotionChannels.filter((x: string) => x !== c.v) : [...f.promotionChannels, c.v])}
                  className={`px-3 h-9 rounded-full border text-xs font-semibold ${on ? "bg-amber-400 text-black border-amber-400" : "border-white/15 text-white/70 hover:border-white/30"}`}>
                  {c.l}
                </button>
              );
            })}
          </div>
          <Err k="promotionChannels" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className={label}>Audience size</span>
            <select className={input} value={f.audienceSize} onChange={(e) => set("audienceSize", e.target.value)}>
              <option value="">Select</option>
              {["<1k", "1k-10k", "10k-50k", "50k-100k", "100k+"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div><span className={label}>PAN (optional)</span><input className={input} value={f.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} /><Err k="pan" /></div>
          <div className="sm:col-span-2"><span className={label}>Social / channel links</span><textarea className={`${input} h-20 py-2`} value={f.socialLinks} onChange={(e) => set("socialLinks", e.target.value)} placeholder="One per line" /></div>
        </div>
        <div>
          <span className={label}>Payout to *</span>
          <div className="flex gap-2 mb-3">
            {["upi", "bank"].map((m) => (
              <button type="button" key={m} onClick={() => set("payoutMethod", m)}
                className={`px-4 h-9 rounded-lg border text-xs font-bold uppercase ${f.payoutMethod === m ? "bg-white text-black border-white" : "border-white/15 text-white/60"}`}>{m === "upi" ? "UPI" : "Bank account"}</button>
            ))}
          </div>
          {f.payoutMethod === "upi" ? (
            <><input className={input} value={f.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="name@bank" /><Err k="upiId" /></>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              <div><input className={input} value={f.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} placeholder="Account holder" /><Err k="bankAccountName" /></div>
              <div><input className={input} value={f.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\D/g, ""))} placeholder="Account number" /><Err k="bankAccountNumber" /></div>
              <div><input className={input} value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} placeholder="IFSC" maxLength={11} /><Err k="ifsc" /></div>
            </div>
          )}
        </div>
        <label className="flex items-start gap-3 text-sm text-white/60 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-amber-400" checked={f.agreedToTerms} onChange={(e) => set("agreedToTerms", e.target.checked)} />
          <span>I agree to the partner terms: commission is paid on verified payments only, held {status?.holdDays ?? 7} days for refunds, and reversed if a payment is refunded. No spam or misleading promotion.</span>
        </label>
        <Err k="agreedToTerms" />
        <button disabled={apply.isPending || !f.agreedToTerms} className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-bold inline-flex items-center justify-center gap-2">
          {apply.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Submit application
        </button>
      </form>
    </div>
  );
}

/* ───────────── Under review ───────────── */
function UnderReview({ status }: { status: any }) {
  const app = status.application;
  const due = new Date(new Date(app.createdAt).getTime() + (status.reviewSlaHours || 24) * 3600000);
  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <div className="w-16 h-16 mx-auto rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
        <Clock className="w-8 h-8 text-amber-300" />
      </div>
      <h1 className="mt-6 text-3xl font-black text-white">Application under review</h1>
      <p className="mt-3 text-white/60">
        Thanks for applying to the partner program. Our team is reviewing your application and it will be approved within {status.reviewSlaHours || 24} hours.
        We'll email you as soon as it's done.
      </p>
      <div className={`${card} mt-8 p-5 text-left space-y-3 text-sm`}>
        {[
          { t: "Application submitted", d: fmtDate(app.createdAt), done: true },
          { t: "Under review", d: app.status === "under_review" ? "In progress" : "Queued", done: app.status === "under_review" },
          { t: "Approved — dashboard unlocked", d: `Expected by ${due.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} IST`, done: false },
        ].map((s) => (
          <div key={s.t} className="flex items-center gap-3">
            {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border-2 border-white/20" />}
            <span className="flex-1 text-white">{s.t}</span>
            <span className="text-white/45">{s.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Partner dashboard ───────────── */
function Stat({ icon: I, label: l, value, sub, accent = "text-white" }: any) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center gap-2 text-white/50 text-xs font-semibold"><I className="w-4 h-4" />{l}</div>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
    </div>
  );
}

function PartnerDashboard({ status }: { status: any }) {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"referrals" | "commissions" | "payouts">("referrals");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const { data: dashRes, isLoading } = usePartnerDashboard(days);
  const refs = usePartnerReferrals(page, tab === "referrals");
  const comms = usePartnerCommissions(page, tab === "commissions");
  const payouts = usePartnerPayouts(true);
  const requestPayout = useRequestPayout();
  const savePan = useSavePartnerPan();
  const [panInput, setPanInput] = useState("");
  const d = dashRes?.data;
  const p = d?.partner || status.partner;
  const s = d?.stats;
  const openPayout = (payouts.data?.data || []).find((x: any) => x.status === "requested");

  const chart = useMemo(
    () => (s?.chart || []).map((r: any) => ({ ...r, label: new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) })),
    [s?.chart],
  );

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  const share = async () => {
    const text = `Watch the best shows on ashqe. Sign up with my code ${p.code}: ${p.shareLink}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "ashqe", text, url: p.shareLink }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  const onPayout = async () => {
    try {
      await requestPayout.mutateAsync();
      toast({ title: "Payout requested", description: "We'll transfer it to your registered account shortly." });
    } catch (e: any) {
      toast({ title: "Can't request payout", description: e?.message, variant: "destructive" });
    }
  };

  if (isLoading || !s) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  const panOnFile = !!p.panOnFile;
  const canWithdraw = s.availableBalance >= (d.program?.minPayout || 500) && !openPayout && panOnFile;
  const est = d.tds?.estimateOnAvailable;
  const onSavePan = async () => {
    const v = panInput.trim().toUpperCase();
    if (!PAN_REGEX.test(v)) { toast({ title: "Invalid PAN", description: "Format: AAAAA9999A", variant: "destructive" }); return; }
    try { await savePan.mutateAsync(v); setPanInput(""); toast({ title: "PAN saved" }); }
    catch (e: any) { toast({ title: "Couldn't save PAN", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300 flex items-center gap-2"><Handshake className="w-4 h-4" /> Partner dashboard</p>
          <h1 className="text-3xl font-black text-white mt-2">Hi {p.displayName?.split(" ")[0]}, here's how you're doing</h1>
          <p className="text-sm text-white/50 mt-1">You earn {p.commissionRate}% on every subscription bought by users you refer.{p.status === "suspended" && <span className="text-rose-400"> Your partner account is suspended.</span>}</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10 w-fit">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setDays(n)} className={`px-3 h-8 rounded-lg text-xs font-bold ${days === n ? "bg-white text-black" : "text-white/60"}`}>{n}d</button>
          ))}
        </div>
      </div>

      {/* Code + link */}
      <div className={`${card} p-5 grid md:grid-cols-[auto_1fr_auto] gap-4 items-center`}>
        <div>
          <p className="text-xs text-white/50">Your partner code</p>
          <button onClick={() => copy(p.code, "code")} className="mt-1 inline-flex items-center gap-2 text-2xl font-black tracking-widest text-amber-300">
            {p.code} {copied === "code" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/40" />}
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white/50">Share link</p>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3 h-11">
            <Link2 className="w-4 h-4 text-white/40 shrink-0" />
            <span className="truncate text-sm text-white/80">{p.shareLink}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => copy(p.shareLink, "link")} className="h-11 px-4 rounded-xl border border-white/15 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/5">
            {copied === "link" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />} Copy link
          </button>
          <button onClick={share} className="h-11 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold inline-flex items-center gap-2"><Share2 className="w-4 h-4" /> Share</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Users referred" value={s.usersReferred.toLocaleString("en-IN")} sub={`${s.payingUsers} paying · ${s.conversionRate}% conversion`} />
        <Stat icon={TrendingUp} label="Revenue generated" value={inr(s.revenueGenerated)} sub={`${s.salesCount} subscriptions sold`} />
        <Stat icon={IndianRupee} label="Total earned" value={inr(s.commission.earned, 2)} sub={`${inr(s.commission.pending, 2)} on hold · ${inr(s.commission.paid, 2)} paid`} accent="text-amber-300" />
        <Stat icon={Wallet} label="Available to withdraw" value={inr(s.availableBalance, 2)} sub={`Minimum ${inr(d.program?.minPayout)}`} accent="text-emerald-300" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-white">Revenue & commission</p>
          <p className="text-xs text-white/40">Last {days} days (IST)</p>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} /><stop offset="100%" stopColor="#fbbf24" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.5} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} formatter={(v: any) => inr(v, 2)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#fbbf24" fill="url(#gRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="commission" name="Commission" stroke="#34d399" fill="url(#gCom)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-sm font-bold text-white">Signups & sales</p>
          <p className="text-xs text-white/40">Users who joined with your code, and how many bought</p>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="signups" name="Signups" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payout bar */}
      <div className={`${card} p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="text-sm">
          <p className="font-bold text-white">Withdraw earnings</p>
          <p className="text-white/50 mt-0.5">
            Paid to {p.payoutDestination || "your registered account"}. Commission becomes withdrawable {d.program?.holdDays ?? 7} days after the purchase.
            {openPayout && <span className="text-amber-300"> A payout of {inr(openPayout.netAmount || openPayout.amount, 2)} (net of TDS) is being processed.</span>}
          </p>
          {est && s.availableBalance > 0 && (
            <p className="text-white/70 mt-2 font-mono text-xs">
              Gross {inr(s.availableBalance, 2)} − TDS {d.program?.tdsRate}% {inr(est.tdsAmount, 2)} = <span className="text-emerald-300 font-bold">Net {inr(est.netAmount, 2)}</span>
            </p>
          )}
          <p className="text-white/40 mt-1 text-xs">
            TDS FY {d.tds?.financialYear}: {inr(d.tds?.tdsDeducted, 2)} deducted on {inr(d.tds?.grossPaid, 2)} paid. TDS applies once your FY commission exceeds {inr(d.program?.tdsThresholdPerFY)}.
            {panOnFile ? <> PAN {p.pan} on file.</> : null}
          </p>
          {!panOnFile && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-amber-300 text-xs font-semibold">PAN is required before your first payout.</span>
              <input value={panInput} onChange={(e) => setPanInput(e.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F"
                className="h-9 w-36 rounded-lg bg-black/40 border border-white/15 px-3 text-sm font-mono text-white" />
              <button onClick={onSavePan} disabled={savePan.isPending} className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold text-white">Save PAN</button>
            </div>
          )}
        </div>
        <button onClick={onPayout} disabled={!canWithdraw || requestPayout.isPending}
          className="h-11 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-black font-bold text-sm inline-flex items-center gap-2 shrink-0">
          {requestPayout.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Request payout · net {inr(est ? est.netAmount : s.availableBalance, 2)}
        </button>
      </div>

      {/* Tables */}
      <div className={card}>
        <div className="flex gap-1 p-2 border-b border-white/10">
          {(["referrals", "commissions", "payouts"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`px-4 h-9 rounded-lg text-sm font-semibold capitalize ${tab === t ? "bg-white/10 text-white" : "text-white/50"}`}>{t}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === "referrals" && (
            <Table head={["User", "Joined", "Status", "Purchases", "Spent", "Your commission"]} loading={refs.isLoading}
              rows={(refs.data?.data || []).map((r: any) => [r.name, fmtDate(r.joinedAt), r.isPaying ? <Pill s="approved" /> : <span className="text-white/40 text-xs">Signed up</span>, r.purchases, inr(r.spent, 2), <span className="text-amber-300 font-semibold">{inr(r.commission, 2)}</span>])} />
          )}
          {tab === "commissions" && (
            <Table head={["Date", "User", "Plan", "Paid (incl. GST)", "Rate", "Commission", "Status"]} loading={comms.isLoading}
              rows={(comms.data?.data || []).map((c: any) => [fmtDate(c.createdAt), c.userName || "—", <span>{c.planName}{c.isRenewal && <span className="ml-1 text-[10px] text-sky-300">renewal</span>}</span>, <span>{inr(c.saleAmount, 2)}{c.discountAmount > 0 && <span className="block text-[10px] text-emerald-300">{c.discountPercent}% buyer discount</span>}</span>, `${c.rate}%`, <span className="font-semibold text-white">{inr(c.amount, 2)}</span>, <span title={c.status === "pending" ? `Confirms on ${fmtDate(c.holdUntil)}` : c.reversalReason || ""}><Pill s={c.status} /></span>])} />
          )}
          {tab === "payouts" && (
            <Table head={["Requested", "Gross", "TDS", "Net paid", "To", "Status", "Reference", "Processed"]} loading={payouts.isLoading}
              rows={(payouts.data?.data || []).map((x: any) => [fmtDate(x.createdAt), inr(x.amount, 2), <span className="text-rose-300">{x.tdsAmount ? `−${inr(x.tdsAmount, 2)}` : "—"}</span>, <span className="font-semibold text-emerald-300">{inr(x.netAmount ?? x.amount, 2)}</span>, x.destination, <Pill s={x.status} />, x.reference || x.adminNote || "—", fmtDate(x.processedAt)])} />
          )}
        </div>
        {tab !== "payouts" && (() => {
          const pg = (tab === "referrals" ? refs : comms).data?.pagination;
          if (!pg || pg.totalPages <= 1) return null;
          return (
            <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10 text-sm text-white/60">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 h-8 rounded-lg border border-white/10 disabled:opacity-30">Prev</button>
              <span>{page} / {pg.totalPages}</span>
              <button disabled={page >= pg.totalPages} onClick={() => setPage(page + 1)} className="px-3 h-8 rounded-lg border border-white/10 disabled:opacity-30">Next</button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Table({ head, rows, loading }: { head: string[]; rows: any[][]; loading?: boolean }) {
  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>;
  if (!rows.length) return <div className="p-10 text-center text-sm text-white/40 flex flex-col items-center gap-2"><XCircle className="w-5 h-5" />Nothing here yet</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-white/40">{head.map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/5 text-white/75">{r.map((c, j) => <td key={j} className="px-4 py-3 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

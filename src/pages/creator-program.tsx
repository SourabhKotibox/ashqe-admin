import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, CheckCircle2, Clapperboard, Film, Loader2, Mail, Plus, ShieldCheck, Tv, X, XCircle,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/pages/streaming-home";
import { useToast } from "@/hooks/use-toast";
import {
  fmtDateTime, useApplyForCreator, useCreatorApplicationStatus, type CreatorContentType,
} from "@/lib/creator-api";

const card = "bg-white/[0.03] border border-white/10 rounded-2xl";
const input =
  "w-full h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/60";
const label = "text-xs font-semibold text-white/60 mb-1.5 block";

const STATUS_COPY: Record<string, { title: string; tone: string }> = {
  pending: { title: "Pending review", tone: "border-amber-400/30 bg-amber-400/10 text-amber-100" },
  under_review: { title: "Under review", tone: "border-sky-400/30 bg-sky-400/10 text-sky-100" },
  approved: { title: "Approved", tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" },
  rejected: { title: "Not approved", tone: "border-rose-400/30 bg-rose-400/10 text-rose-100" },
};

export default function CreatorProgramPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("appUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleSignOut = () => {
    ["appUser", "appAccessToken", "refreshToken", "ott_active_profile"].forEach((k) => localStorage.removeItem(k));
    setUser(null);
    setLocation("/login");
  };

  return (
    <div className="min-h-screen text-foreground flex flex-col bg-[#030306]">
      <PublicHeader
        activeTab="home"
        setActiveTab={(tab) => (tab === "home" ? setLocation("/") : setLocation(`/browse/${tab}`))}
        onSignIn={() => setLocation("/login")}
        onSignOut={handleSignOut}
        user={user}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-28 pb-16 space-y-10">
        <Hero />
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-8 items-start">
          <HowItWorks />
          <ApplyCard />
        </div>
        <StatusCheck />
        <p className="text-center text-sm text-white/45">
          Looking to earn commission by referring subscribers instead?{" "}
          <button type="button" onClick={() => setLocation("/partner-program")} className="text-amber-300 font-semibold hover:underline">
            Partner Program
          </button>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 via-violet-500/10 to-transparent p-8 sm:p-12">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
        <Clapperboard className="w-4 h-4" /> Creator Program
      </span>
      <h1 className="mt-4 text-3xl sm:text-5xl font-black text-white leading-tight max-w-3xl">
        Publish your movies and web series on Ashqe
      </h1>
      <p className="mt-4 text-white/60 text-base sm:text-lg max-w-2xl">
        This is for filmmakers and creators who own their films. Apply, get an Ashqe creator login by email, upload your titles, and go live after our editors review them. It is separate from the Partner Program, which is only for referring subscribers.
      </p>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Mail, t: "1. Apply", d: "Tell us who you are, what you make, and share a few samples. You must confirm you own the rights." },
    { icon: ShieldCheck, t: "2. Get approved", d: "We review the application. If approved, you receive a creator login and a one-time password by email." },
    { icon: Film, t: "3. Upload", d: "Sign in, set a new password, then upload movies and web series. Video goes straight to storage while it processes." },
    { icon: Tv, t: "4. Review & publish", d: "Submit a title for review. After an editor approves it, the movie or series is published on Ashqe." },
  ];
  return (
    <div className="space-y-4">
      {steps.map(({ icon: Icon, t, d }) => (
        <div key={t} className={`${card} p-5 flex gap-4`}>
          <div className="h-10 w-10 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">{t}</h3>
            <p className="mt-1 text-sm text-white/55">{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApplyCard() {
  const { toast } = useToast();
  const apply = useApplyForCreator();
  const [done, setDone] = useState<{ applicationId?: string; email: string } | null>(null);
  const [contentTypes, setContentTypes] = useState<CreatorContentType[]>([]);
  const [sampleLinks, setSampleLinks] = useState<string[]>([""]);
  const [copyrightAttested, setCopyrightAttested] = useState(false);
  const [website, setWebsite] = useState("");
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", city: "", state: "", channelName: "", portfolioSummary: "",
  });

  const toggleType = (value: CreatorContentType) => {
    setContentTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentTypes.length) {
      toast({ title: "Choose at least one content type", variant: "destructive" });
      return;
    }
    if (!copyrightAttested) {
      toast({ title: "Copyright confirmation is required", variant: "destructive" });
      return;
    }
    try {
      const res = await apply.mutateAsync({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        channelName: form.channelName.trim() || undefined,
        contentTypes,
        sampleLinks: sampleLinks.map((s) => s.trim()).filter(Boolean),
        portfolioSummary: form.portfolioSummary.trim(),
        copyrightAttested: true,
        website,
      });
      setDone({ applicationId: res?.data?.applicationId, email: form.email.trim() });
      toast({ title: "Application submitted", description: res?.message || "We'll email you after review." });
    } catch (err: any) {
      const duplicate = err?.status === 409;
      toast({
        title: duplicate ? "Already applied" : "Could not submit",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (done) {
    return (
      <div className={`${card} p-6 sm:p-8 space-y-4`}>
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        <h2 className="text-2xl font-black text-white">Application received</h2>
        <p className="text-sm text-white/60">
          Thanks. Your creator application{done.applicationId ? ` (${done.applicationId})` : ""} is pending review.
          We'll email <span className="text-white">{done.email}</span> when there's a decision. If you're approved, that email includes a login and a temporary password.
        </p>
        <p className="text-sm text-white/50">You can check the status anytime with the form below.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${card} p-6 sm:p-8 space-y-4`}>
      <div>
        <h2 className="text-xl font-bold text-white">Creator application</h2>
        <p className="text-sm text-white/50 mt-1">Movies and web series you have the rights to publish.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <span className={label}>Full name *</span>
          <input className={input} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <span className={label}>Email *</span>
          <input type="email" className={input} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <span className={label}>Phone *</span>
          <input className={input} required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile number" />
        </div>
        <div>
          <span className={label}>City</span>
          <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <span className={label}>State</span>
          <input className={input} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <span className={label}>Channel or studio name</span>
          <input className={input} value={form.channelName} onChange={(e) => setForm({ ...form, channelName: e.target.value })} placeholder="YouTube, studio, or production house" />
        </div>
      </div>

      <div>
        <span className={label}>What will you publish? *</span>
        <div className="flex flex-wrap gap-3">
          {([
            ["movie", "Movies"],
            ["webseries", "Web Series"],
          ] as const).map(([value, text]) => (
            <label key={value} className={`inline-flex items-center gap-2 px-3 h-11 rounded-xl border cursor-pointer ${contentTypes.includes(value) ? "border-amber-400/60 bg-amber-400/10 text-white" : "border-white/10 text-white/70"}`}>
              <input type="checkbox" className="accent-amber-400" checked={contentTypes.includes(value)} onChange={() => toggleType(value)} />
              {text}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={label}>Sample links</span>
          <button type="button" onClick={() => setSampleLinks((p) => [...p, ""])} className="text-xs font-semibold text-amber-300 inline-flex items-center gap-1 mb-1.5">
            <Plus className="w-3.5 h-3.5" /> Add link
          </button>
        </div>
        <div className="space-y-2">
          {sampleLinks.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={input}
                placeholder="https://"
                value={link}
                onChange={(e) => setSampleLinks((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
              />
              {sampleLinks.length > 1 && (
                <button type="button" onClick={() => setSampleLinks((prev) => prev.filter((_, idx) => idx !== i))} className="h-11 w-11 rounded-xl border border-white/10 text-white/60 hover:text-white" aria-label="Remove link">
                  <X className="w-4 h-4 mx-auto" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Portfolio summary *</span>
        <textarea
          required
          rows={4}
          className={`${input} h-auto py-3`}
          placeholder="What have you made, and what do you want to release on Ashqe?"
          value={form.portfolioSummary}
          onChange={(e) => setForm({ ...form, portfolioSummary: e.target.value })}
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-white/70">
        <input type="checkbox" className="mt-1 accent-amber-400" checked={copyrightAttested} onChange={(e) => setCopyrightAttested(e.target.checked)} />
        <span>I confirm I own the copyright to the films I will upload, or I have written permission to publish them on Ashqe.</span>
      </label>

      {/* Honeypot: left blank by people, filled by bots. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <button disabled={apply.isPending || !copyrightAttested} className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-bold inline-flex items-center justify-center gap-2">
        {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Submit application
      </button>
    </form>
  );
}

function StatusCheck() {
  const [, setLocation] = useLocation();
  const check = useCreatorApplicationStatus();
  const [email, setEmail] = useState("");
  const result = check.data?.data;

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await check.mutateAsync(email.trim());
    } catch (err: any) {
      /* mutation error is shown below */
    }
  };

  return (
    <section className={`${card} p-6 sm:p-8`}>
      <h2 className="text-xl font-bold text-white">Check application status</h2>
      <p className="text-sm text-white/50 mt-1">Use the email you applied with.</p>
      <form onSubmit={lookup} className="mt-4 flex flex-col sm:flex-row gap-3 max-w-xl">
        <input type="email" required className={input} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button disabled={check.isPending} className="h-11 px-5 rounded-xl bg-white text-black font-bold inline-flex items-center justify-center gap-2 shrink-0">
          {check.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Check status
        </button>
      </form>
      {check.isError && (
        <p className="mt-4 text-sm text-rose-300">{(check.error as any)?.message || "Could not check status."}</p>
      )}
      {result && !result.found && (
        <p className="mt-4 text-sm text-white/70">No creator application found for this email.</p>
      )}
      {result?.found && result.status && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${STATUS_COPY[result.status]?.tone || "border-white/10 text-white"}`}>
          <p className="font-bold">{STATUS_COPY[result.status]?.title || result.status}</p>
          {result.submittedAt && <p className="mt-1 text-white/70">Submitted {fmtDateTime(result.submittedAt)}</p>}
          {result.reviewedAt && <p className="text-white/70">Reviewed {fmtDateTime(result.reviewedAt)}</p>}
          {result.status === "approved" && (
            <button type="button" onClick={() => setLocation("/admin/login")} className="mt-3 inline-flex items-center gap-1 font-bold text-emerald-200 hover:underline">
              Sign in to the creator console <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {result.status === "rejected" && (
            <p className="mt-2 flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {result.rejectionReason || "The application was not approved."}
            </p>
          )}
          {result.status === "pending" && <p className="mt-2 text-white/70">We have your application and have not started the review yet.</p>}
          {result.status === "under_review" && <p className="mt-2 text-white/70">An editor is looking at your application now.</p>}
        </div>
      )}
    </section>
  );
}

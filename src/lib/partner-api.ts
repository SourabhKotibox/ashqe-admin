import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getApiBaseUrl } from "@/lib/api-client";

/* ───────────── Partner program API (user + admin) ───────────── */

const REF_KEY = "ashqe_partner_ref";
const REF_TTL_MS = 30 * 86400000;

export const inr = (n: number | undefined | null, digits = 0) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

/** Save ?ref=CODE from the URL so it can be attached after the visitor signs in. */
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9]{3,20}$/.test(code)) {
      localStorage.setItem(REF_KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
    }
  } catch {}
}

export function getStoredReferral(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(REF_KEY) || "null");
    if (!v?.code || Date.now() - v.at > REF_TTL_MS) return null;
    return v.code;
  } catch {
    return null;
  }
}

let attaching = false;
/** If a stored referral exists and the visitor is now signed in, attach it once. */
export async function attachStoredReferral() {
  const code = getStoredReferral();
  if (!code || attaching || !localStorage.getItem("appAccessToken")) return;
  attaching = true;
  try {
    await apiRequest("/api/app/partner/referral", { method: "POST", body: JSON.stringify({ code, source: "link" }) });
    localStorage.removeItem(REF_KEY);
  } catch (e: any) {
    // Definitive rejections (already referred, own code, window passed, invalid) → stop retrying
    if (e?.status && e.status >= 400 && e.status < 500 && e.status !== 401) localStorage.removeItem(REF_KEY);
  } finally {
    attaching = false;
  }
}

// ── User ──
export const usePartnerStatus = (enabled = true) =>
  useQuery({ queryKey: ["partner-status"], queryFn: () => apiRequest("/api/app/partner/status"), enabled, retry: false });

export const usePartnerDashboard = (days: number, enabled = true) =>
  useQuery({ queryKey: ["partner-dashboard", days], queryFn: () => apiRequest(`/api/app/partner/dashboard?days=${days}`), enabled });

export const usePartnerReferrals = (page: number, enabled = true) =>
  useQuery({ queryKey: ["partner-referrals", page], queryFn: () => apiRequest(`/api/app/partner/referrals?page=${page}&limit=10`), enabled });

export const usePartnerCommissions = (page: number, enabled = true) =>
  useQuery({ queryKey: ["partner-commissions", page], queryFn: () => apiRequest(`/api/app/partner/commissions?page=${page}&limit=10`), enabled });

export const usePartnerPayouts = (enabled = true) =>
  useQuery({ queryKey: ["partner-payouts"], queryFn: () => apiRequest("/api/app/partner/payouts"), enabled });

export const useApplyForPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => apiRequest("/api/app/partner/apply", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-status"] }),
  });
};

export const useRequestPayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("/api/app/partner/payouts", { method: "POST", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-payouts"] });
      qc.invalidateQueries({ queryKey: ["partner-dashboard"] });
    },
  });
};

export const useSavePartnerPan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pan: string) => apiRequest("/api/app/partner/pan", { method: "PUT", body: JSON.stringify({ pan }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-dashboard"] }),
  });
};

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Server-computed checkout price (partner discount is never computed client-side). */
export const fetchCheckoutQuote = (planId: string, code?: string) =>
  apiRequest("/api/app/subscription/partner-quote", { method: "POST", body: JSON.stringify({ planId, code: code || undefined }) });

/** Admin: download TDS-by-partner CSV for a financial year. */
export async function downloadTdsReport(fy: string) {
  const token = localStorage.getItem("adminAccessToken");
  const res = await fetch(`${getApiBaseUrl()}/api/partners/tds-report?fy=${encodeURIComponent(fy)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `partner-tds-${fy}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Indian FY label in IST, e.g. "2026-27". */
export function currentFy(d = new Date()) {
  const ist = new Date(d.getTime() + 330 * 60000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const useApplyReferralCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiRequest("/api/app/partner/referral", { method: "POST", body: JSON.stringify({ code, source: "manual_code" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-status"] }),
  });
};

// ── Admin ──
const qs = (o: Record<string, any>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== "all").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

export const useAdminPartnerOverview = () => useQuery({ queryKey: ["admin-partner-overview"], queryFn: () => apiRequest("/api/partners/overview") });
export const useAdminPartnerApplications = (p: { status?: string; search?: string; page?: number }) =>
  useQuery({ queryKey: ["admin-partner-apps", p], queryFn: () => apiRequest(`/api/partners/applications?${qs({ ...p, limit: 20 })}`) });
export const useAdminPartners = (p: { status?: string; search?: string; page?: number }) =>
  useQuery({ queryKey: ["admin-partners", p], queryFn: () => apiRequest(`/api/partners?${qs({ ...p, limit: 20 })}`) });
export const useAdminPartner = (id?: string) =>
  useQuery({ queryKey: ["admin-partner", id], queryFn: () => apiRequest(`/api/partners/${id}`), enabled: !!id });
export const useAdminPartnerCommissions = (p: { status?: string; partnerId?: string; page?: number }) =>
  useQuery({ queryKey: ["admin-partner-commissions", p], queryFn: () => apiRequest(`/api/partners/commissions?${qs({ ...p, limit: 20 })}`) });
export const useAdminPartnerPayouts = (p: { status?: string; partnerId?: string }) =>
  useQuery({ queryKey: ["admin-partner-payouts", p], queryFn: () => apiRequest(`/api/partners/payouts?${qs(p)}`) });
export const useAdminPartnerSettings = () => useQuery({ queryKey: ["admin-partner-settings"], queryFn: () => apiRequest("/api/partners/settings") });

const useAdminMutation = (fn: (v: any) => Promise<any>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ["admin-partner-overview", "admin-partner-apps", "admin-partners", "admin-partner", "admin-partner-commissions", "admin-partner-payouts", "admin-partner-settings"])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
};

export const useReviewApplication = () =>
  useAdminMutation(({ id, ...body }) => apiRequest(`/api/partners/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
export const useUpdatePartner = () =>
  useAdminMutation(({ id, ...body }) => apiRequest(`/api/partners/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
export const useReverseCommission = () =>
  useAdminMutation(({ id, reason }) => apiRequest(`/api/partners/commissions/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }));
export const useProcessPayout = () =>
  useAdminMutation(({ id, ...body }) => apiRequest(`/api/partners/payouts/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
export const useUpdatePartnerSettings = () =>
  useAdminMutation((body) => apiRequest("/api/partners/settings", { method: "PUT", body: JSON.stringify(body) }));
export const useAttributeUser = () =>
  useAdminMutation((body) => apiRequest("/api/partners/attribute", { method: "POST", body: JSON.stringify(body) }));

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

export type CreatorContentType = "movie" | "webseries";
export type CreatorApplicationStatus = "pending" | "under_review" | "approved" | "rejected";

export type CreatorApplicationPayload = {
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  channelName?: string;
  contentTypes: CreatorContentType[];
  sampleLinks?: string[];
  portfolioSummary: string;
  copyrightAttested: true;
  website?: string;
};

export const fmtDateTime = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function formatBytes(bytes?: number | null) {
  const n = Number(bytes || 0);
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export const applicationIdOf = (row: any) => String(row?._id || row?.id || row?.applicationId || "");

export const useApplyForCreator = () =>
  useMutation({
    mutationFn: (body: CreatorApplicationPayload) =>
      apiRequest("/api/public/creator/apply", { method: "POST", body: JSON.stringify(body) }),
  });

export const useCreatorApplicationStatus = () =>
  useMutation({
    mutationFn: (email: string) =>
      apiRequest(`/api/public/creator/status?email=${encodeURIComponent(email)}`),
  });

export const useAdminCreatorApplications = (options: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (options.status && options.status !== "all") params.set("status", options.status);
  if (options.search) params.set("search", options.search);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: ["creator-applications", options],
    queryFn: () => apiRequest(`/api/admin/creator-applications${qs ? `?${qs}` : ""}`),
  });
};

export const useAdminCreatorApplication = (id?: string) =>
  useQuery({
    queryKey: ["creator-application", id],
    queryFn: () => apiRequest(`/api/admin/creator-applications/${id}`),
    enabled: !!id,
  });

export const useApproveCreatorApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiRequest(`/api/admin/creator-applications/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: notes || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-applications"] });
      qc.invalidateQueries({ queryKey: ["creator-application"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
};

export const useRejectCreatorApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      apiRequest(`/api/admin/creator-applications/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-applications"] });
      qc.invalidateQueries({ queryKey: ["creator-application"] });
    },
  });
};

export const useCreatorDashboard = () =>
  useQuery({
    queryKey: ["creator-dashboard"],
    queryFn: () => apiRequest("/api/creator/dashboard"),
  });

export const SOCIAL_PLATFORMS = ["instagram", "youtube", "facebook", "x", "website", "other"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLink = { platform: SocialPlatform; url: string };

export type CreatorApplicationProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  channelName: string;
  contentTypes: string[];
  sampleLinks: string[];
  portfolioSummary: string;
  status: string;
  copyrightAttested: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason?: string;
  adminNotes?: string;
};

/** GET /api/creator/profile and GET /api/admin/creators/:id/profile share this shape. */
export type CreatorProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  bio: string;
  socialLinks: SocialLink[];
  role: string;
  isActive: boolean;
  application: CreatorApplicationProfile | null;
};

export type CreatorProfilePatch = {
  name?: string;
  avatar?: string;
  bio?: string;
  socialLinks?: SocialLink[];
};

export const useOwnCreatorProfile = () =>
  useQuery({
    queryKey: ["creator-profile", "me"],
    queryFn: () => apiRequest("/api/creator/profile") as Promise<{ success: boolean; data: CreatorProfile }>,
  });

export const useUpdateOwnCreatorProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatorProfilePatch) =>
      apiRequest("/api/creator/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

export const useStaffCreatorProfile = (id?: string) =>
  useQuery({
    queryKey: ["creator-profile", "staff", id],
    queryFn: () =>
      apiRequest(`/api/admin/creators/${encodeURIComponent(id || "")}/profile`) as Promise<{ success: boolean; data: CreatorProfile }>,
    enabled: !!id,
  });

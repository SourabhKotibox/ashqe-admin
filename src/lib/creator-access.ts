/** Console paths an approved creator (`role === "influencer"`) may open. */
export const CREATOR_ROUTE_PREFIXES = [
  "/dashboard",
  "/earnings",
  "/media-library",
  "/movies",
  "/tv-shows",
  "/episodes",
  "/seasons",
  "/profile",
];

/**
 * Creator earnings live on `/earnings` for every influencer.
 * `creatorRevenue` is the staff permission for the admin overview and rate edits.
 * The API rejects influencer tokens on `/api/admin/creator-revenue/*`.
 */
export const CREATOR_EARNINGS_PATH = "/earnings";
export const ADMIN_CREATOR_REVENUE_PATH = "/creator-revenue";

type RevenuePermissionUser = {
  role?: string;
  modulePermissions?: {
    creatorRevenue?: { canView?: boolean; canEdit?: boolean };
  } | null;
} | null | undefined;

export function canViewCreatorRevenueAdmin(user: RevenuePermissionUser) {
  if (!user || user.role === "influencer") return false;
  if (user.role === "superadmin" || user.role === "admin") return true;
  const perms = user.modulePermissions?.creatorRevenue;
  return Boolean(perms?.canView || perms?.canEdit);
}

export function canEditCreatorRevenue(user: RevenuePermissionUser) {
  if (!user || user.role === "influencer") return false;
  if (user.role === "superadmin") return true;
  return Boolean(user.modulePermissions?.creatorRevenue?.canEdit);
}

export function isInfluencerRole(user: { role?: string } | null | undefined) {
  return user?.role === "influencer";
}

/**
 * Catalog modules an influencer account is granted.
 * Crew people use `directors` (there is no `crews` key).
 * Country writes use `countries` for creators. Staff country writes still use `settings`.
 */
export const CATALOG_MODULE_KEYS = {
  language: "languages",
  genre: "genres",
  actor: "actors",
  director: "directors",
  crew: "directors",
  country: "countries",
} as const;

export type CatalogPermissionKind = keyof typeof CATALOG_MODULE_KEYS;
export type CatalogPermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

type PermissionUser = {
  role?: string;
  id?: string;
  _id?: string;
  modulePermissions?: Record<string, Partial<Record<CatalogPermissionAction, boolean>> | undefined>;
} | null | undefined;

export function catalogModuleKey(kind: CatalogPermissionKind) {
  return CATALOG_MODULE_KEYS[kind];
}

/**
 * Influencers are checked against the catalog key above.
 * Other roles keep the existing form behavior; the API still enforces their module flags.
 */
export function hasCatalogPermission(user: PermissionUser, kind: CatalogPermissionKind, action: CatalogPermissionAction) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (!isInfluencerRole(user)) return true;
  return Boolean(user.modulePermissions?.[CATALOG_MODULE_KEYS[kind]]?.[action]);
}

/** Creators may edit or delete a catalog row only when `createdBy` is their own id. */
export function canMutateOwnedCatalogRow(
  user: PermissionUser,
  kind: CatalogPermissionKind,
  createdBy: unknown,
  action: "canEdit" | "canDelete"
) {
  if (!hasCatalogPermission(user, kind, action)) return false;
  if (!isInfluencerRole(user)) return true;
  const owner = createdBy && typeof createdBy === "object"
    ? ((createdBy as { _id?: unknown; id?: unknown })._id || (createdBy as { id?: unknown }).id)
    : createdBy;
  const self = user?.id || user?._id;
  return Boolean(self) && String(owner || "") === String(self);
}

const CREATOR_EDITORIAL_KEYS = ["status", "featured", "trending", "isFeatured", "isTrending"] as const;

/**
 * Creators must not send publish or editorial flags. The API rejects
 * `status: "published"` and any featured/trending value that is on, including
 * when an editor already set those flags and the creator is only saving edits.
 */
export function omitCreatorEditorialFields<T extends Record<string, any>>(payload: T, isCreator: boolean): T {
  if (!isCreator) return payload;
  const next = { ...payload };
  for (const key of CREATOR_EDITORIAL_KEYS) delete next[key];
  return next;
}

export function isCreatorConsolePath(path: string) {
  return CREATOR_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export const MUST_CHANGE_PASSWORD_KEY = "mustChangePassword";

export function readMustChangePasswordFlag() {
  try {
    return sessionStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMustChangePasswordFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "1");
    else sessionStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  } catch {
    /* ignore private-mode storage failures */
  }
}

/** Login and profile payloads both may carry the first-login flag. */
export function mustChangePasswordFromAuthPayload(data: any): boolean {
  return Boolean(data?.mustChangePassword ?? data?.user?.mustChangePassword ?? data?.adminUser?.mustChangePassword);
}

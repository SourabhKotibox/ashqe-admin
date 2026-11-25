type ModuleGrant = {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canUpload?: boolean;
};

const NONE: ModuleGrant = { canView: false, canCreate: false, canEdit: false, canDelete: false };
const CATALOG: ModuleGrant = { canView: true, canCreate: true, canEdit: true, canDelete: true };

/**
 * Permission pack for the influencer role. Mirrors
 * `CREATOR_MODULE_PERMISSIONS` on ashqe-api-server. Approval grants this pack;
 * the console uses it so a creator sees these sections even when the login
 * payload is still missing flags.
 * Catalog edit/delete stay limited to rows the creator owns.
 */
export const CREATOR_MODULE_PERMISSIONS: Record<string, ModuleGrant> = {
  users: { ...NONE },
  movies: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  tvShows: { canView: true, canCreate: true, canEdit: true, canDelete: false },
  genres: { ...CATALOG },
  actors: { ...CATALOG },
  directors: { ...CATALOG },
  languages: { ...CATALOG },
  countries: { ...CATALOG },
  categories: { ...NONE },
  mediaLibrary: { canView: true, canUpload: true, canDelete: false },
  banners: { ...NONE },
  promotions: { ...NONE },
  influencers: { ...NONE },
  ads: { ...NONE },
  pages: { ...NONE },
  faqs: { ...NONE },
  subscriptions: { ...NONE },
  subscriptionPlans: { ...NONE },
  planLimits: { ...NONE },
  notifications: { ...NONE },
  notificationTemplates: { ...NONE },
  settings: { ...NONE },
  reviews: { ...NONE },
};

/** A copy safe to send when creating or updating a creator account. */
export function cloneCreatorModulePermissions() {
  return JSON.parse(JSON.stringify(CREATOR_MODULE_PERMISSIONS)) as Record<string, ModuleGrant>;
}

/**
 * Console paths an approved creator (`role === "influencer"`) may open.
 * `module` is the pack key. Crew uses `directors` (there is no crews key).
 * Null means the path is part of the creator console and is not module-gated.
 */
export const CREATOR_ROUTES: { prefix: string; module: string | null }[] = [
  { prefix: "/dashboard", module: null },
  { prefix: "/profile", module: null },
  { prefix: "/media-library", module: "mediaLibrary" },
  { prefix: "/movies", module: "movies" },
  { prefix: "/tv-shows", module: "tvShows" },
  { prefix: "/episodes", module: "tvShows" },
  { prefix: "/seasons", module: "tvShows" },
  { prefix: "/languages", module: "languages" },
  { prefix: "/genres", module: "genres" },
  { prefix: "/actors", module: "actors" },
  { prefix: "/directors", module: "directors" },
  { prefix: "/crew", module: "directors" },
  { prefix: "/countries", module: "countries" },
];

export const CREATOR_ROUTE_PREFIXES = CREATOR_ROUTES.map((route) => route.prefix);

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
/** Pack module for a creator console path. Undefined means the path is outside the creator console. */
export function creatorModuleForPath(path: string): string | null | undefined {
  const match = CREATOR_ROUTES
    .filter((route) => path === route.prefix || path.startsWith(`${route.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return undefined;
  return match.module;
}

function packAllows(moduleName: string | null | undefined, ...actions: string[]) {
  if (moduleName == null) return true;
  const grant = CREATOR_MODULE_PERMISSIONS[moduleName];
  if (!grant) return false;
  const needed = actions.length > 0 ? actions : ["canView", "canUpload"];
  return needed.some((action) => Boolean(grant[action as keyof ModuleGrant]));
}

/**
 * Influencers open a creator section when the role pack allows it.
 * A partial user payload does not hide those sections, and it does not
 * open anything outside the pack.
 */
export function influencerMayOpenPath(path: string) {
  const moduleName = creatorModuleForPath(path);
  if (moduleName === undefined) return false;
  return packAllows(moduleName, "canView", "canUpload");
}

export function hasCatalogPermission(user: PermissionUser, kind: CatalogPermissionKind, action: CatalogPermissionAction) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (!isInfluencerRole(user)) return true;
  const moduleName = CATALOG_MODULE_KEYS[kind];
  const fromPack = Boolean(CREATOR_MODULE_PERMISSIONS[moduleName]?.[action]);
  const fromPayload = Boolean(user.modulePermissions?.[moduleName]?.[action]);
  return fromPack || fromPayload;
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

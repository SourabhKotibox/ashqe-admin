/** Console paths an approved creator (`role === "influencer"`) may open. */
export const CREATOR_ROUTE_PREFIXES = [
  "/dashboard",
  "/media-library",
  "/movies",
  "/tv-shows",
  "/episodes",
  "/seasons",
  "/profile",
];

export function isInfluencerRole(user: { role?: string } | null | undefined) {
  return user?.role === "influencer";
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

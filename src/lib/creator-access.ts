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

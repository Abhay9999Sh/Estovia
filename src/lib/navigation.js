/**
 * Return the correct destination for the "List Your Land" call-to-action
 * based on the current authentication and role state.
 *
 * - Not logged in -> signup (creates an account, then onboarding).
 * - Logged in as a landowner -> go straight to adding a land listing.
 * - Logged in but not yet a landowner -> complete profile (choose role).
 */
export function listLandTarget({ isLoggedIn, user }) {
  if (!isLoggedIn) return "/signup";
  if (Array.isArray(user?.roles) && user.roles.includes("landowner")) {
    return "/landowner/land/new";
  }
  return "/complete-profile";
}

/**
 * Return the correct destination for a user after they successfully
 * authenticate, based on their actual roles:
 *
 * - admin        -> Admin Dashboard (never complete-profile/onboarding)
 * - landowner    -> Landowner Dashboard
 * - builder      -> Builder Dashboard
 * - supplier     -> Supplier Dashboard
 * - buyer        -> Buyer Dashboard
 * - viewer with profileCompleted -> home (browsing only)
 * - viewer without profileCompleted -> complete-profile (choose a role)
 */
export function roleDestination(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("landowner")) return "/landowner/dashboard";
  if (roles.includes("builder")) return "/builder/dashboard";
  if (roles.includes("supplier")) return "/supplier/dashboard";
  if (roles.includes("buyer")) return "/buyer/dashboard";
  if (user?.profileCompleted) return "/";
  return "/complete-profile";
}

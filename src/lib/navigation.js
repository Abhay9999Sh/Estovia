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

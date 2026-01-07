/**
 * Auth Login Route
 *
 * Handles login flow with Cloudflare Access.
 * When users hit this route, CF Access will intercept if not authenticated.
 * If already authenticated, redirect to the requested page or home.
 *
 * InfoSec: OWASP A07 - Identification and Authentication Failures
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Get return URL from query param, default to home
  const returnTo = url.searchParams.get('return') || '/';

  // InfoSec: Validate return URL to prevent open redirect (OWASP A01)
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  // If user is authenticated (CF Access headers present), redirect
  if (locals.user) {
    redirect(302, safeReturnTo);
  }

  // If not authenticated, CF Access should intercept this request
  // and show the login page. If it doesn't (e.g., route not protected),
  // show a message.
  return {
    returnTo: safeReturnTo
  };
};

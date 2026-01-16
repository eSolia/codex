/**
 * Auth Login Route
 *
 * If already authenticated via CF Access, redirect to return URL.
 * Otherwise, show login page with CF Access link.
 *
 * InfoSec: OWASP A07 - Identification and Authentication Failures
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  // Get return URL from query param, default to home
  const returnTo = url.searchParams.get('return') || '/';

  // InfoSec: Validate return URL to prevent open redirect (OWASP A01)
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  // If already authenticated, redirect to destination
  if (locals.user) {
    redirect(302, safeReturnTo);
  }

  // Build CF Access login URL
  const fullReturnUrl = `${url.origin}${safeReturnTo}`;
  const cfAccessLoginUrl = `/cdn-cgi/access/login?redirect_url=${encodeURIComponent(fullReturnUrl)}`;

  return {
    returnTo: safeReturnTo,
    cfAccessLoginUrl,
  };
};

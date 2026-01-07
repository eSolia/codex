/**
 * Auth Login Route
 *
 * Redirects to the protected page, which triggers Cloudflare Access login.
 * CF Access will intercept the request and show the login page if not authenticated.
 *
 * InfoSec: OWASP A07 - Identification and Authentication Failures
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  // Get return URL from query param, default to home
  const returnTo = url.searchParams.get('return') || '/';

  // InfoSec: Validate return URL to prevent open redirect (OWASP A01)
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  // Always redirect to the return URL
  // If it's protected by CF Access, the login page will appear
  // If user is already authenticated, they'll see the page
  redirect(302, safeReturnTo);
};

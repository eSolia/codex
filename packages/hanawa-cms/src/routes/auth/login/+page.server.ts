/**
 * Auth Login Route
 *
 * Redirects to Cloudflare Access login endpoint.
 * After authentication, CF Access redirects back to the return URL.
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

  // Build full return URL for CF Access
  const fullReturnUrl = `${url.origin}${safeReturnTo}`;

  // Redirect to CF Access login endpoint with return URL
  // CF Access will authenticate and redirect back
  const cfAccessLogin = `/cdn-cgi/access/login?redirect_url=${encodeURIComponent(fullReturnUrl)}`;

  redirect(302, cfAccessLogin);
};

/**
 * Auth Logout Route
 *
 * Redirects to Cloudflare Access logout endpoint.
 * This clears the CF Access session cookie and logs the user out.
 *
 * InfoSec: OWASP A07 - Proper session termination
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  // Cloudflare Access logout endpoint
  // This works for any CF Access protected application
  const logoutUrl = `${url.origin}/cdn-cgi/access/logout`;

  redirect(302, logoutUrl);
};

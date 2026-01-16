/**
 * Root Layout Server
 *
 * Passes user info from locals to layout for display.
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
  };
};

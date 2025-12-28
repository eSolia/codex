/**
 * Assets List Page Server Load
 * The MediaLibrary component handles all data fetching via API
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Data is loaded client-side via /api/media endpoints
  return {};
};

import type { PageServerLoad } from './$types';
import report from '$lib/data/asvs-assessment.json';

export const load: PageServerLoad = async () => {
  return { report };
};

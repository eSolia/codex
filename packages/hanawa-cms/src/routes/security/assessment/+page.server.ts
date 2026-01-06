/**
 * Security Assessment Page Server
 *
 * Loads the ASVS assessment JSON report for display.
 * Full detailed report requires authentication.
 * Public visitors see summary statistics only.
 *
 * InfoSec: Detailed security assessments are valuable for client due diligence
 * but should not be publicly exposed as they could inform attack strategies.
 */

import type { PageServerLoad } from './$types';
import report from '$lib/data/asvs-assessment.json';

export const load: PageServerLoad = async ({ locals }) => {
  const isAuthenticated = !!locals.user;

  // Calculate summary stats (safe to show publicly)
  const applicableChecks = report.summary.total - (report.summary.notApplicable || 0);
  const score = Math.round((report.summary.passed / applicableChecks) * 100);

  if (isAuthenticated) {
    // Authenticated users get the full detailed report
    return {
      authenticated: true,
      report,
      summary: {
        total: report.summary.total,
        passed: report.summary.passed,
        failed: report.summary.failed,
        warnings: report.summary.warnings,
        notApplicable: report.summary.notApplicable,
        score,
        coverage: report.summary.coverage,
        timestamp: report.timestamp,
        version: report.version
      }
    };
  }

  // Public visitors get summary only - no detailed check information
  return {
    authenticated: false,
    report: null,
    summary: {
      total: report.summary.total,
      passed: report.summary.passed,
      failed: report.summary.failed,
      warnings: report.summary.warnings,
      notApplicable: report.summary.notApplicable,
      score,
      coverage: report.summary.coverage,
      timestamp: report.timestamp,
      version: report.version
    }
  };
};

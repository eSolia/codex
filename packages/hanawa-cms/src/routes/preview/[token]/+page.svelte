<script lang="ts">
  /**
   * Preview Page
   * Secure content preview with deterrence measures
   *
   * InfoSec: Watermarking, screenshot shield, session logging
   */
  import type { PageData } from './$types';
  import ScreenshotShield from '$lib/components/security/ScreenshotShield.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Content Preview | Hanawa CMS</title>
  <!-- InfoSec: Prevent search engine indexing -->
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
</svelte:head>

<ScreenshotShield
  viewerEmail={data.viewerEmail}
  documentId={data.documentId}
  sensitivity={data.sensitivity}
>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <!-- Preview Banner -->
      <div
        class="mb-6 p-4 rounded-lg {data.sensitivity === 'embargoed'
          ? 'bg-red-50 border border-red-200'
          : data.sensitivity === 'confidential'
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'}"
      >
        <div class="flex items-center gap-2">
          {#if data.sensitivity === 'embargoed'}
            <span class="text-red-600">🔒</span>
            <span class="font-medium text-red-800">Embargoed Preview</span>
          {:else if data.sensitivity === 'confidential'}
            <span class="text-yellow-600">⚠️</span>
            <span class="font-medium text-yellow-800">Confidential Preview</span>
          {:else}
            <span class="text-blue-600">ℹ️</span>
            <span class="font-medium text-blue-800">Preview Mode</span>
          {/if}
        </div>
        <p
          class="mt-1 text-sm {data.sensitivity === 'embargoed'
            ? 'text-red-700'
            : data.sensitivity === 'confidential'
              ? 'text-yellow-700'
              : 'text-blue-700'}"
        >
          This is a preview. Content may change before publication.
          {#if data.sensitivity !== 'normal'}
            All viewing activity is logged.
          {/if}
        </p>
      </div>

      <!-- Content -->
      <article class="bg-white rounded-lg shadow-lg p-8">
        <div
          class="prose prose-lg max-w-none prose-headings:text-esolia-navy prose-a:text-esolia-navy"
        >
          {@html data.content}
        </div>
      </article>

      <!-- Footer -->
      <div class="mt-8 text-center text-sm text-gray-500">
        <p>Powered by Hanawa CMS</p>
      </div>
    </div>
  </div>
</ScreenshotShield>

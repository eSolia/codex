<script lang="ts">
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
  import ShieldWarning from 'phosphor-svelte/lib/ShieldWarning';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

  // InfoSec: Custom error page prevents stack trace leakage in production (OWASP A05)
  const statusMessages: Record<number, { title: string; description: string }> = {
    400: {
      title: 'Bad Request',
      description: 'The request could not be understood or was missing required parameters.',
    },
    401: {
      title: 'Unauthorized',
      description: 'Authentication is required to access this resource.',
    },
    403: {
      title: 'Forbidden',
      description: "You don't have permission to access this resource.",
    },
    404: {
      title: 'Not Found',
      description: 'The requested resource could not be found.',
    },
    429: {
      title: 'Too Many Requests',
      description: 'Rate limit exceeded. Please try again later.',
    },
    500: {
      title: 'Internal Server Error',
      description: 'An unexpected error occurred. Our team has been notified.',
    },
    503: {
      title: 'Service Unavailable',
      description: 'The service is temporarily unavailable. Please try again later.',
    },
  };

  const status = $page.status;
  const errorInfo = statusMessages[status] || {
    title: 'Error',
    description: 'An unexpected error occurred.',
  };

  // InfoSec: Only expose error message in production, not stack traces
  const displayMessage = $page.error?.message || errorInfo.description;

  // Type-safe stack trace access (stack is non-standard but exists in all browsers)
  const errorStack = $page.error && 'stack' in $page.error ? $page.error.stack : null;
</script>

<svelte:head>
  <title>{errorInfo.title} - Hanawa CMS</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="max-w-2xl w-full">
    <div class="bg-white rounded-lg shadow-lg p-8 md:p-12">
      <!-- Error Icon -->
      <div class="flex justify-center mb-6">
        <div class="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
          <ShieldWarning size={48} weight="duotone" class="text-rose-600" />
        </div>
      </div>

      <!-- Error Status -->
      <div class="text-center mb-6">
        <h1 class="text-6xl font-bold text-rose-600 mb-2">{status}</h1>
        <h2 class="text-2xl font-semibold text-gray-800 mb-4">{errorInfo.title}</h2>
        <p class="text-gray-600 leading-relaxed">
          {displayMessage}
        </p>
      </div>

      <!-- Development Mode: Stack Trace -->
      {#if dev && errorStack}
        <details class="mt-6 p-4 bg-gray-100 rounded-lg border border-gray-300">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 mb-2">
            Development: Stack Trace
          </summary>
          <pre
            class="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap break-words">{errorStack}</pre>
        </details>
      {/if}

      <!-- Actions -->
      <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
          Go to Dashboard
        </a>

        <button
          type="button"
          onclick={() => window.history.back()}
          class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Go Back
        </button>
      </div>

      <!-- Request ID (for support) -->
      {#if $page.data?.requestId}
        <div class="mt-8 pt-6 border-t border-gray-200 text-center">
          <p class="text-xs text-gray-500">
            Request ID:
            <code class="px-2 py-1 bg-gray-100 rounded text-gray-700 font-mono"
              >{$page.data.requestId}</code
            >
          </p>
          <p class="text-xs text-gray-400 mt-1">
            Please reference this ID when contacting support.
          </p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="mt-6 text-center">
      <p class="text-sm text-gray-500">
        Need help? Contact
        <a href="mailto:help@esolia.co.jp" class="text-rose-600 hover:text-rose-700 underline">
          help@esolia.co.jp
        </a>
      </p>
    </div>
  </div>
</div>

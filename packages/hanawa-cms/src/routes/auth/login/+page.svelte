<script lang="ts">
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

  let { data } = $props();
</script>

<svelte:head>
  <title>Sign In - Hanawa CMS</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
  <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
    <div class="mb-6 text-center">
      <div
        class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100"
      >
        <ShieldCheck size={32} weight="duotone" class="text-rose-600" />
      </div>
      <h1 class="text-2xl font-bold text-zinc-900">Authentication Required</h1>
      <p class="mt-2 text-zinc-600">
        Access to Hanawa CMS is protected by Cloudflare Access.
      </p>
    </div>

    <div class="space-y-4 text-center">
      <p class="text-sm text-zinc-500">
        If you're seeing this page, the Cloudflare Access login should appear automatically.
        If it doesn't, please contact your administrator.
      </p>

      <div class="pt-4">
        <a
          href={data.returnTo}
          class="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700"
        >
          <ArrowLeft size={16} />
          Return to previous page
        </a>
      </div>
    </div>
  </div>
</div>

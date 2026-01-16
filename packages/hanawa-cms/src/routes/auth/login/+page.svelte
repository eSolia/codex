<script lang="ts">
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import SignIn from 'phosphor-svelte/lib/SignIn';

  let { data } = $props();
</script>

<svelte:head>
  <title>Sign In - Hanawa CMS</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
  <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
    <div class="mb-6 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
        <ShieldCheck size={32} weight="duotone" class="text-rose-600" />
      </div>
      <h1 class="text-2xl font-bold text-zinc-900">Sign In Required</h1>
      <p class="mt-2 text-zinc-600">Access to this content requires authentication.</p>
    </div>

    <div class="space-y-4">
      <a
        href={data.cfAccessLoginUrl}
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-6 py-3 font-medium text-white transition-colors hover:bg-rose-600"
      >
        <SignIn size={20} />
        Sign In with Cloudflare Access
      </a>

      <div class="pt-4 text-center">
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

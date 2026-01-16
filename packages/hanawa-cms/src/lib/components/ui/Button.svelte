<!--
  Button Component (bits-ui based)
  Consistent button styling across the application

  Usage:
  <Button variant="primary" size="md" onclick={handleClick}>Click me</Button>
  <Button variant="outline" href="/path">Link Button</Button>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg';

  interface Props {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    href?: string;
    class?: string;
    children: Snippet;
  }

  type ButtonProps = Props &
    Omit<HTMLButtonAttributes, 'class' | 'disabled'> &
    Omit<HTMLAnchorAttributes, 'class' | 'href'>;

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    href,
    class: className = '',
    children,
    ...restProps
  }: ButtonProps = $props();

  const variantClasses: Record<Variant, string> = {
    primary:
      'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 disabled:bg-rose-300',
    secondary:
      'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400',
    outline:
      'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-rose-500 disabled:bg-gray-50 disabled:text-gray-400',
    ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-rose-500 disabled:text-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300',
  };

  const sizeClasses: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed';

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
</script>

{#if href && !disabled}
  <a {href} class={classes} {...restProps}>
    {#if loading}
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    {/if}
    {@render children()}
  </a>
{:else}
  <button type="button" class={classes} disabled={disabled || loading} {...restProps}>
    {#if loading}
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    {/if}
    {@render children()}
  </button>
{/if}

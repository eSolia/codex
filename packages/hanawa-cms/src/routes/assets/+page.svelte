<script lang="ts">
  import MediaLibrary from "$lib/components/MediaLibrary.svelte";
</script>

<svelte:head>
  <title>Assets | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-esolia-navy">Assets</h1>
    <p class="mt-1 text-gray-600">Images, documents, and media files stored in R2</p>
  </div>

  <!-- Media Library Component -->
  <div class="bg-white rounded-lg shadow p-6">
    <MediaLibrary acceptTypes={["image/*", "application/pdf", "text/csv", "application/json"]} />
  </div>
</div>

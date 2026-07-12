<script lang="ts">
  import { setIcon } from "obsidian";

  let { name }: { name: string } = $props();

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    if (el) setIcon(el, name);
  });
</script>

<span class="bs-icon" bind:this={el} aria-hidden="true"></span>

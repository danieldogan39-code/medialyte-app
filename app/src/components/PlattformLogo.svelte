<script lang="ts">
  // Original-Logo einer Plattform, so wie man es vom App-Symbol kennt
  import { MARKE } from "../lib/marken";
  let { name, size = 44, rund = 0.28 }: { name: string; size?: number; rund?: number } = $props();
  const r = $derived(Math.round(size * rund));
</script>

{#if name === "instagram"}
  <span class="lg" style="width:{size}px;height:{size}px;border-radius:{r}px;background:radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)">
    <svg viewBox="0 0 24 24" width={size * .6} height={size * .6} aria-hidden="true"><path fill="#fff" d={MARKE.instagram} /></svg></span>
{:else if name === "facebook"}
  <span class="lg weiss" style="width:{size}px;height:{size}px;border-radius:{r}px">
    <svg viewBox="0 0 24 24" width={size * .66} height={size * .66} aria-hidden="true"><path fill="#0866FF" d={MARKE.facebook} /></svg></span>
{:else if name === "tiktok"}
  <span class="lg" style="width:{size}px;height:{size}px;border-radius:{r}px;background:#000">
    <svg viewBox="-1 -1 26 26" width={size * .62} height={size * .62} aria-hidden="true">
      <path fill="#25F4EE" transform="translate(-.6 -.6)" d={MARKE.tiktok} /><path fill="#FE2C55" transform="translate(.6 .6)" d={MARKE.tiktok} /><path fill="#fff" d={MARKE.tiktok} /></svg></span>
{:else if name === "linkedin"}
  <span class="lg weiss" style="width:{size}px;height:{size}px;border-radius:{r}px">
    <svg viewBox="0 0 24 24" width={size * .62} height={size * .62} aria-hidden="true"><path fill="#0A66C2" d={MARKE.linkedin} /></svg></span>
{:else if name === "youtube"}
  <span class="lg weiss" style="width:{size}px;height:{size}px;border-radius:{r}px">
    <svg viewBox="0 0 24 24" width={size * .7} height={size * .7} aria-hidden="true"><path fill="#FF0000" d={MARKE.youtube} /></svg></span>
{:else if name === "google"}
  <span class="lg weiss" style="width:{size}px;height:{size}px;border-radius:{r}px">
    <svg viewBox="0 0 48 48" width={size * .6} height={size * .6} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg></span>
{/if}

<style>
  .lg { display: inline-grid; place-items: center; flex: none; box-shadow: 0 10px 24px -12px rgba(0, 0, 0, .7), inset 0 0 0 1px rgba(255, 255, 255, .06); }
  .lg.weiss { background: #fff; }
  svg { display: block; }
</style>

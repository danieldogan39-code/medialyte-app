<script lang="ts">
  // Zeichen des Organizers: ein Ring, der sich schließt, mit einem Haken – „erledigt, im Plan“
  let { size = 40, animiert = false }: { size?: number; animiert?: boolean } = $props();
  const id = "oz" + Math.random().toString(36).slice(2, 8);
</script>
<svg width={size} height={size} viewBox="0 0 48 48" class:animiert aria-hidden="true">
  <defs>
    <linearGradient id="{id}a" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#A897FF"/><stop offset=".55" stop-color="#7C8CFF"/><stop offset="1" stop-color="#4FD1B5"/></linearGradient>
    <linearGradient id="{id}b" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#E9E4FF" stop-opacity=".9"/></linearGradient>
  </defs>
  <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#{id}a)"/>
  <rect x="2.5" y="2.5" width="43" height="43" rx="12.5" fill="none" stroke="#fff" stroke-opacity=".22"/>
  <circle class="ring" cx="24" cy="24" r="12.5" fill="none" stroke="url(#{id}b)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="62 100" transform="rotate(-210 24 24)"/>
  <path class="haken" d="m18.5 24.5 4 4 8-9" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="35.2" cy="15.2" r="2.6" fill="#fff"/>
</svg>
<style>
  svg { display: block; flex: none; filter: drop-shadow(0 8px 18px rgba(124, 140, 255, .35)); }
  .animiert .ring { stroke-dasharray: 0 100; animation: ring 1s .15s cubic-bezier(.3, .8, .2, 1) forwards; }
  .animiert .haken { stroke-dasharray: 20; stroke-dashoffset: 20; animation: haken .5s .7s cubic-bezier(.3, .8, .2, 1) forwards; }
  @keyframes ring { to { stroke-dasharray: 62 100; } }
  @keyframes haken { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .animiert .ring, .animiert .haken { animation: none; stroke-dasharray: 62 100; stroke-dashoffset: 0; } .animiert .haken { stroke-dasharray: none; } }
</style>

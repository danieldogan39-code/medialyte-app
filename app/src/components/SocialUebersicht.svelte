<script lang="ts">
  // Einstieg: je Plattform eine große Kachel; ein Tipp öffnet die Plattform mit ihren Inhaltstypen
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { social, PLATTFORMEN, TYPEN, typName, typenVon, offen, type Creative, type Plattform } from "../lib/social.svelte";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../lib/bewegung";

  const fk = federKurve(0.5, 0.06);
  const aktiv = $derived(social.sortiert().filter((c) => c.status !== "verworfen"));
  const auf = (p: Plattform) => aktiv.filter((c) => typenVon(c, p).length);
  const proTyp = (p: Plattform, l: Creative[]) => p.typen.map((t) => ({ t, n: l.filter((c) => typenVon(c, p).includes(t)).length })).filter((x) => x.n);
  const freigabe = $derived(aktiv.filter((c) => c.status === "pruefen"));
  const ohne = $derived(aktiv.filter((c) => !PLATTFORMEN.some((p) => typenVon(c, p).length)));
  const bild = (c: Creative) => (c.vorschau ? social.bild[c.vorschau] : "");
  const favoriten = $derived(social.liste.filter((c) => c.favorit));
  // die nächsten in der Posting-Reihenfolge (Nummer 1 zuerst)
  const naechste = $derived(aktiv.filter(offen).slice(0, 8));
  const wo = (c: Creative) => PLATTFORMEN.filter((p) => typenVon(c, p).length).slice(0, 3);
</script>

<div class="kacheln">
  {#each PLATTFORMEN as p, i (p.key)}
    {@const l = auf(p)}
    <a class="pk" href="#/social/k/{p.key}" style="--p: {p.farbe}; --fl: {p.flaeche}"
      in:fly={{ y: ruhig() ? 0 : 16, duration: ruhig() ? 0 : fk.ms, delay: ruhig() ? 0 : i * 50, easing: fk.easing, opacity: 0 }}>
      <span class="pk__glanz" aria-hidden="true"></span>
      <span class="pk__kopf">
        <PlattformLogo name={p.key} size={52} />
        <span class="pk__name"><b>{p.name}</b><small>{l.length ? `${l.length} ${l.length === 1 ? "Creative" : "Creatives"}` : "Noch leer"}</small></span>
        <span class="pk__pfeil"><Icon name="right" size={18} /></span>
      </span>
      <span class="pk__typen">
        {#each proTyp(p, l) as x (x.t)}<span><Icon name={TYPEN[x.t].icon} size={13} />{x.n} {typName(p, x.t, x.n !== 1)}</span>
        {:else}<span class="leer">Sag Claude, was du für {p.name} brauchst.</span>{/each}
      </span>
      <span class="pk__faecher" aria-hidden="true">
        {#each l.slice(0, 3) as c, j (c.id)}{#if bild(c)}<img src={bild(c)} alt="" draggable="false" style="--j: {j}">{/if}{/each}
      </span>
    </a>
  {/each}
</div>

{#if naechste.length}
  <section class="naechste" aria-labelledby="sn-t">
    <div class="naechste__k"><h3 id="sn-t">Als Nächstes posten</h3><a href="#/social/bibliothek">Ganze Reihenfolge<Icon name="right" size={14} /></a></div>
    <ol class="reihe">
      {#each naechste as c, i (c.id)}
        <li><a href="#/social/c/{c.slug}" class="nx">
          <span class="nx__b">{#if bild(c)}<img src={bild(c)} alt="" draggable="false" loading="lazy">{/if}<span class="nx__nr num">{i + 1}</span>{#if c.favorit}<span class="nx__st"><Icon name="star" size={12} fill /></span>{/if}</span>
          <span class="nx__t">{c.titel}</span>
          <span class="nx__p">{#each wo(c) as p (p.key)}<PlattformLogo name={p.key} size={16} rund={0.3} />{/each}</span>
        </a></li>
      {/each}
    </ol>
  </section>
{/if}

{#if freigabe.length || ohne.length || favoriten.length}
  <div class="neben">
    {#if favoriten.length}
      <a class="nk card" href="#/social/k/favoriten">
        <span class="nk__i nk__i--stern"><Icon name="star" size={18} fill /></span>
        <span><b>Favoriten</b><small class="muted">{favoriten.length} {favoriten.length === 1 ? "Creative" : "Creatives"} mit Stern</small></span>
        <Icon name="right" size={16} />
      </a>
    {/if}
    {#if freigabe.length}
      <a class="nk card" href="#/social/k/freigabe">
        <span class="nk__i nk__i--gelb"><Icon name="check" size={18} /></span>
        <span><b>Zur Freigabe</b><small class="muted">{freigabe.length} {freigabe.length === 1 ? "Creative wartet" : "Creatives warten"} auf dein Okay</small></span>
        <Icon name="right" size={16} />
      </a>
    {/if}
    {#if ohne.length}
      <a class="nk card" href="#/social/k/ohne">
        <span class="nk__i"><Icon name="image" size={18} /></span>
        <span><b>Ohne Plattform</b><small class="muted">{ohne.length} noch keiner Plattform zugeordnet</small></span>
        <Icon name="right" size={16} />
      </a>
    {/if}
  </div>
{/if}

<style>
  .kacheln { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .pk { position: relative; isolation: isolate; overflow: hidden; display: grid; gap: 14px; align-content: start; min-height: 220px; padding: 20px 22px;
    border-radius: 20px; color: var(--text); background: var(--panel); border: 1px solid var(--line);
    transition: transform .45s var(--feder-schnell), border-color .25s ease, box-shadow .35s ease; }
  .pk__glanz { position: absolute; inset: 0; z-index: -1; background: radial-gradient(420px 260px at 100% 100%, color-mix(in srgb, var(--p) 26%, transparent), transparent 70%),
    radial-gradient(300px 200px at 0% 0%, color-mix(in srgb, var(--p) 10%, transparent), transparent 70%); }
  .pk:active { transform: scale(.985); }
  .pk:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .pk__kopf { display: flex; align-items: center; gap: 14px; }
  .pk__logo { width: 52px; height: 52px; flex: none; border-radius: 15px; display: grid; place-items: center; color: #fff; background: var(--fl);
    box-shadow: 0 12px 26px -12px var(--p), inset 0 1px 0 rgba(255, 255, 255, .3); }
  .pk__name { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .pk__name b { font-size: 1.25rem; font-weight: 600; letter-spacing: -.02em; }
  .pk__name small { color: var(--steel); font-size: .84rem; }
  .pk__pfeil { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--text-2); background: rgba(255, 255, 255, .05);
    transition: transform .45s var(--feder-schnell), background-color .25s ease; }
  .pk__typen { display: flex; flex-wrap: wrap; gap: 6px; max-width: 62%; position: relative; z-index: 1; }
  .pk__typen span { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 999px; font-size: .8rem; color: var(--text-2);
    background: rgba(10, 18, 32, .55); border: 1px solid var(--line); }
  .pk__typen span :global(svg) { color: var(--p); }
  .pk__typen .leer { background: none; border: 0; padding: 0; color: var(--steel); height: auto; }
  .pk__faecher { position: absolute; right: 18px; bottom: -26px; width: 150px; height: 150px; pointer-events: none; }
  .pk__faecher img { position: absolute; right: calc(var(--j) * 40px); bottom: 0; width: 84px; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 10px;
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, .8), 0 0 0 1px rgba(255, 255, 255, .08); transform: rotate(calc(var(--j) * -7deg + 6deg)); transform-origin: 50% 100%;
    transition: transform .55s var(--feder-schnell); z-index: calc(3 - var(--j)); }
  @media (hover: hover) and (pointer: fine) {
    .pk:hover { border-color: color-mix(in srgb, var(--p) 45%, var(--line)); box-shadow: 0 24px 50px -30px var(--p); }
    .pk:hover .pk__pfeil { transform: translateX(3px); background: rgba(255, 255, 255, .1); }
    .pk:hover .pk__faecher img { transform: rotate(calc(var(--j) * -10deg + 8deg)) translateY(-8px); }
  }
  .neben { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; margin-top: 14px; }
  .nk { display: flex; align-items: center; gap: 14px; padding: 14px 16px; color: inherit; }
  .nk > span:nth-child(2) { display: grid; gap: 2px; flex: 1; }
  .nk b { font-weight: 600; color: var(--text); }
  .nk small { font-size: .8rem; }
  .nk > :global(svg:last-child) { color: var(--steel); }
  .nk__i { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--panel-2); color: var(--text-2); }
  .nk__i--gelb { background: rgba(231, 185, 74, .15); color: #EBC56B; }
  .nk__i--stern { background: rgba(247, 198, 94, .14); color: #F7C65E; }
  .naechste { margin-top: 22px; display: grid; gap: 10px; }
  .naechste__k { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .naechste__k h3 { font-size: 1.05rem; font-weight: 600; }
  .naechste__k a { display: inline-flex; align-items: center; gap: 2px; color: var(--steel); font-size: .86rem; }
  .naechste__k a:hover { color: var(--text); }
  .reihe { list-style: none; margin: 0; padding: 2px 2px 6px; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(118px, 1fr); gap: 10px; overflow-x: auto;
    scroll-snap-type: x proximity; scrollbar-width: none; }
  .reihe::-webkit-scrollbar { display: none; }
  .reihe li { scroll-snap-align: start; min-width: 0; }
  .nx { display: grid; gap: 6px; color: inherit; }
  .nx__b { position: relative; display: block; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden; background: var(--panel-2); border: 1px solid var(--line);
    transition: transform .45s var(--feder-schnell), border-color .25s ease; }
  .nx:active .nx__b { transform: scale(.97); }
  .nx__b img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .nx__nr { position: absolute; left: 6px; top: 6px; min-width: 26px; height: 26px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center;
    background: var(--text); color: var(--bg); font-weight: 700; font-size: .84rem; box-shadow: 0 6px 14px -6px rgba(0, 0, 0, .7); }
  .nx__st { position: absolute; right: 6px; top: 6px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #F7C65E; background: rgba(10, 18, 32, .7); }
  .nx__t { font-size: .82rem; color: var(--text); line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .nx__p { display: flex; gap: 3px; }
  @media (hover: hover) and (pointer: fine) { .nx:hover .nx__b { border-color: var(--line-2); } }
  @media (max-width: 700px) {
    .kacheln { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .pk { min-height: 168px; padding: 18px; }
    .pk__typen { max-width: 60%; }
    .pk__faecher { right: 8px; bottom: -34px; transform: scale(.85); transform-origin: 100% 100%; }
  }
</style>

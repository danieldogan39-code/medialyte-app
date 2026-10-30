<script lang="ts">
  // Hebel zum An- und Ausschalten (role=switch, per Tastatur bedienbar)
  let { an, label, disabled = false, onchange }: { an: boolean; label: string; disabled?: boolean; onchange: (v: boolean) => void } = $props();
</script>
<button type="button" class="sw" role="switch" aria-checked={an} aria-label={label} title={disabled ? "Dafür fehlt dir das Recht" : label} {disabled}
  onclick={(e) => { e.preventDefault(); e.stopPropagation(); onchange(!an); }}><span class="sw__k"></span></button>
<style>
  .sw { position: relative; flex: none; width: 46px; height: 28px; padding: 0; border-radius: 999px; border: 1px solid var(--line-2); background: rgba(139, 152, 173, .22);
    cursor: pointer; transition: background-color .2s ease, border-color .2s ease; }
  .sw__k { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #E6EBF3; box-shadow: 0 1px 3px rgba(0, 0, 0, .35);
    transition: transform .22s var(--ease); }
  .sw[aria-checked="true"] { background: var(--ok); border-color: #5BD49A; }
  .sw[aria-checked="true"] .sw__k { transform: translateX(18px); background: #fff; }
  .sw:active:not(:disabled) .sw__k { width: 23px; }
  .sw[aria-checked="true"]:active:not(:disabled) .sw__k { transform: translateX(15px); }
  .sw:disabled { opacity: .5; cursor: not-allowed; }
</style>

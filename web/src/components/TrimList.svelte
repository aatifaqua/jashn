<script lang="ts">
  import { formatRupees, type Trim } from '@jashn/core';
  import Why from './Why.svelte';

  /** Ways to save, largest first; trims never apply themselves. */
  interface Props {
    trims: readonly Trim[];
  }
  let { trims }: Props = $props();
</script>

<section class="trims" aria-labelledby="trims-title">
  <h3 id="trims-title">Ways to save</h3>
  {#if trims.length === 0}
    <p class="muted">The budget is comfortable, so no savings are needed.</p>
  {:else}
    <p class="muted">
      Largest saving first. Nothing changes until you ask the assistant or edit the details.
    </p>
    <ul class="trim-list">
      {#each trims as trim (trim.id)}
        <li>
          <p><strong>{trim.label}</strong>: saves about {formatRupees(trim.saves)}</p>
          <Why reasons={trim.reasons} />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<script lang="ts">
  import { fromIso } from '@jashn/core';
  import { MAX_PLANS, type SavedPlan } from '../lib/storage.ts';
  import { dayLabel } from '../lib/format.ts';
  import { eventTitle } from '../lib/labels.ts';
  import ConfirmButton from './ConfirmButton.svelte';

  /** Plans saved in this browser, with open, delete and clear-all controls. */
  interface Props {
    plans: readonly SavedPlan[];
    onopen: (id: string) => void;
    ondelete: (id: string) => void;
    onclear: () => void;
  }
  let { plans, onopen, ondelete, onclear }: Props = $props();

  function when(plan: SavedPlan): string {
    const day = fromIso(plan.input.date);
    return day === null ? plan.input.date : dayLabel(day);
  }
</script>

<section class="my-plans" aria-labelledby="my-plans-title">
  <h2 id="my-plans-title">My plans</h2>
  {#if plans.length === 0}
    <p class="muted">Plans you make are saved in this browser only (up to {MAX_PLANS}).</p>
  {:else}
    <ul class="plan-list">
      {#each plans as plan (plan.id)}
        {@const title = eventTitle(plan.input)}
        <li>
          <button
            type="button"
            class="link-button"
            onclick={() => {
              onopen(plan.id);
            }}
          >
            {title}
          </button>
          <span class="muted">{when(plan)}</span>
          <ConfirmButton
            label="Delete"
            name="Delete {title}, {when(plan)}"
            question="Delete this plan?"
            confirmLabel="Yes, delete"
            onconfirm={() => {
              ondelete(plan.id);
            }}
          />
        </li>
      {/each}
    </ul>
    <p class="muted">Up to {MAX_PLANS} plans are kept; the oldest makes way for a new one.</p>
    <ConfirmButton
      label="Clear all my data"
      question="Delete every saved plan from this browser? This cannot be undone."
      confirmLabel="Yes, clear all my data"
      onconfirm={onclear}
    />
  {/if}
</section>

<script lang="ts">
  import { tick } from 'svelte';
  import { fromIso } from '@jashn/core';
  import { MAX_PLANS, type SavedPlan } from '../lib/storage.ts';
  import { dayLabel } from '../lib/format.ts';
  import { eventTitle } from '../lib/labels.ts';
  import ConfirmButton from './ConfirmButton.svelte';

  /** Plans saved in this browser, with open, delete and clear-all controls. */
  interface Props {
    plans: readonly SavedPlan[];
    /** The calendar day, so events already held are marked as past. */
    today: number;
    onopen: (id: string) => void;
    ondelete: (id: string) => void;
    onclear: () => void;
  }
  let { plans, today, onopen, ondelete, onclear }: Props = $props();

  let heading = $state<HTMLElement>();
  let list = $state<HTMLElement>();

  function when(plan: SavedPlan): string {
    const day = fromIso(plan.input.date);
    return day === null ? plan.input.date : dayLabel(day);
  }

  function isPast(plan: SavedPlan): boolean {
    return (fromIso(plan.input.date) ?? today) < today;
  }

  /**
   * Deleting removes the focused row, so focus moves to the row that took its place (or the
   * last row), or to the heading once the list is empty.
   */
  async function removed(index: number): Promise<void> {
    await tick();
    const rows = list?.querySelectorAll<HTMLButtonElement>('.link-button') ?? [];
    (rows[Math.min(index, rows.length - 1)] ?? heading)?.focus();
  }
</script>

<section class="my-plans" aria-labelledby="my-plans-title">
  <h2 id="my-plans-title" tabindex="-1" bind:this={heading}>My plans</h2>
  {#if plans.length === 0}
    <p class="muted">Plans you make are saved in this browser only (up to {MAX_PLANS}).</p>
  {:else}
    <ul class="plan-list" bind:this={list}>
      {#each plans as plan, index (plan.id)}
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
          {#if isPast(plan)}<span class="badge">Past</span>{/if}
          <ConfirmButton
            label="Delete"
            name="Delete {title}, {when(plan)}"
            question="Delete this plan?"
            confirmLabel="Yes, delete"
            onconfirm={() => {
              ondelete(plan.id);
              void removed(index);
            }}
          />
        </li>
      {/each}
    </ul>
    <p class="muted">
      Up to {MAX_PLANS} plans are kept; the oldest plan without ticked tasks or vendor progress makes
      way for a new one.
    </p>
    <ConfirmButton
      label="Clear all my data"
      question="Delete every saved plan from this browser? This cannot be undone."
      confirmLabel="Yes, clear all my data"
      onconfirm={() => {
        onclear();
        void removed(0);
      }}
    />
  {/if}
</section>

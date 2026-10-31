<script lang="ts">
  import { formatLongDay, type RunSheetSlot } from '@jashn/core';

  /** The day-of schedule as one table per day (several for multi-function weddings). */
  interface Props {
    slots: readonly RunSheetSlot[];
  }
  let { slots }: Props = $props();

  const days = $derived(
    [...new Set(slots.map((slot) => slot.day))].map((day) => ({
      day,
      slots: slots.filter((slot) => slot.day === day),
    })),
  );
</script>

{#if days.length === 0}
  <p class="muted">No run sheet for this event.</p>
{/if}
{#each days as group (group.day)}
  <div class="table-wrap">
    <table class="run-sheet">
      <caption>{formatLongDay(group.day)}</caption>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">What happens</th>
          <th scope="col">Who</th>
        </tr>
      </thead>
      <tbody>
        {#each group.slots as slot, index (index)}
          <tr>
            <td class="nowrap"><time>{slot.start}</time> to <time>{slot.end}</time></td>
            <th scope="row">{slot.title}</th>
            <td>{slot.owner}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/each}

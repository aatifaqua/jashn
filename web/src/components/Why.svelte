<script lang="ts">
  import type { Reason } from '@jashn/core';

  /** A "Why?" disclosure listing the reasons behind a derived item; native, so no script is needed. */
  interface Props {
    reasons: readonly Reason[];
    label?: string;
  }
  let { reasons, label = 'Why?' }: Props = $props();
</script>

{#if reasons.length > 0}
  <details class="why">
    <summary>{label}</summary>
    <ul>
      {#each reasons as reason, index (index)}
        <li>{reason.text}</li>
      {/each}
    </ul>
  </details>
{/if}

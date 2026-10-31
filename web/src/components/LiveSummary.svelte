<script lang="ts">
  import { formatCount, type Plan } from '@jashn/core';
  import { daysToGoText } from '../lib/format.ts';
  import { VERDICTS, perGuestText } from '../lib/labels.ts';
  import Icon from './Icon.svelte';

  /** The figures beside the form, announced politely as they change. */
  interface Props {
    plan: Plan | null;
  }
  let { plan }: Props = $props();
</script>

<aside class="live-summary" aria-labelledby="live-summary-title">
  <h2 id="live-summary-title">At a glance</h2>
  <div aria-live="polite">
    {#if plan === null}
      <p class="muted">Add a date, guest count and budget to see the outlook.</p>
    {:else}
      {@const verdict = VERDICTS[plan.feasibility.verdict]}
      <dl class="figures">
        <div>
          <dt>Countdown</dt>
          <dd>{daysToGoText(plan.daysToGo)}</dd>
        </div>
        <div>
          <dt>Expected guests</dt>
          <dd>{formatCount(plan.expected)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd class="verdict-word verdict-{plan.feasibility.verdict}">
            <Icon name={verdict.icon} />
            {verdict.word}
          </dd>
        </div>
      </dl>
      <p class="muted">{perGuestText(plan.feasibility)}</p>
    {/if}
  </div>
</aside>

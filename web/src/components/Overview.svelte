<script lang="ts">
  import type { Plan } from '@jashn/core';
  import { count, daysToGoText, rupees } from '../lib/format.ts';
  import Icon from './Icon.svelte';
  import TopActions from './TopActions.svelte';
  import VerdictBanner from './VerdictBanner.svelte';

  /** The Overview tab: verdict, key figures, what to do first and the plan's notices. */
  interface Props {
    plan: Plan;
  }
  let { plan }: Props = $props();
</script>

<VerdictBanner feasibility={plan.feasibility} />

<dl class="figures">
  <div>
    <dt>Countdown</dt>
    <dd>{daysToGoText(plan.daysToGo)}</dd>
  </div>
  <div>
    <dt>Expected guests</dt>
    <dd>{count(plan.expected)} of {count(plan.input.invited)} invited</dd>
  </div>
  <div>
    <dt>Budget</dt>
    <dd>{rupees(plan.input.budget)}</dd>
  </div>
  {#if plan.volunteers > 0}
    <div>
      <dt>Volunteers needed</dt>
      <dd>{count(plan.volunteers)}</dd>
    </div>
  {/if}
</dl>

<TopActions actions={plan.topActions} today={plan.today} />

{#if plan.notices.length > 0}
  <section aria-labelledby="notices-title">
    <h3 id="notices-title">Good to know</h3>
    <ul class="notices">
      {#each plan.notices as notice, index (index)}
        <li><Icon name="info" /> {notice.text}</li>
      {/each}
    </ul>
  </section>
{/if}

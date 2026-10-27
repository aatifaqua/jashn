<script lang="ts">
  import { remainingActions, type Plan } from '@jashn/core';
  import { count, daysToGoText, rupees } from '../lib/format.ts';
  import Icon from './Icon.svelte';
  import TopActions from './TopActions.svelte';
  import VerdictBanner from './VerdictBanner.svelte';

  /**
   * The Overview tab: verdict, key figures, what to do first and the plan's notices. Ticked
   * tasks leave "Do these first", and the countdown uses the real today, so a past event reads
   * "Held N days ago" rather than "Today".
   */
  interface Props {
    plan: Plan;
    /** Task ids the user has ticked off. */
    checks: ReadonlySet<string>;
    /** The real calendar day, which is later than plan.today once the event has passed. */
    today: number;
  }
  let { plan, checks, today }: Props = $props();

  const actions = $derived(remainingActions(plan, checks));
</script>

<VerdictBanner feasibility={plan.feasibility} />

<dl class="figures">
  <div>
    <dt>Countdown</dt>
    <dd>{daysToGoText(plan.today + plan.daysToGo - today)}</dd>
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

<TopActions {actions} today={plan.today} />

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

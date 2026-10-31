<script lang="ts">
  import { formatCount, formatRupees, remainingActions, toIso, type Plan } from '@jashn/core';
  import { daysToGoText, shortDay } from '../lib/format.ts';
  import { VERDICTS, perGuestText } from '../lib/labels.ts';
  import Icon from './Icon.svelte';
  import TaskBadge from './TaskBadge.svelte';
  import Why from './Why.svelte';

  /**
   * The Overview tab. Ticked tasks leave "Do these first", and the countdown uses the real
   * today, so a past event reads "Held N days ago" rather than "Today".
   */
  interface Props {
    plan: Plan;
    checks: ReadonlySet<string>;
    /** The real calendar day, which is later than plan.today once the event has passed. */
    today: number;
  }
  let { plan, checks, today }: Props = $props();

  const actions = $derived(remainingActions(plan, checks));
  const feasibility = $derived(plan.feasibility);
  const verdict = $derived(VERDICTS[feasibility.verdict]);
</script>

<!-- The verdict is an icon, a word and a sentence, so it never relies on colour alone. -->
<div class="verdict verdict-{feasibility.verdict}">
  <p class="verdict-head">
    <Icon name={verdict.icon} />
    <span>Budget: <strong>{verdict.word}</strong></span>
  </p>
  <p>{verdict.text}</p>
  <p class="muted">{perGuestText(feasibility)}</p>
</div>

<dl class="figures">
  <div>
    <dt>Countdown</dt>
    <dd>{daysToGoText(plan.today + plan.daysToGo - today)}</dd>
  </div>
  <div>
    <dt>Expected guests</dt>
    <dd>{formatCount(plan.expected)} of {formatCount(plan.input.invited)} invited</dd>
  </div>
  <div>
    <dt>Budget</dt>
    <dd>{formatRupees(plan.input.budget)}</dd>
  </div>
  {#if plan.volunteers > 0}
    <div>
      <dt>Volunteers needed</dt>
      <dd>{formatCount(plan.volunteers)}</dd>
    </div>
  {/if}
</dl>

<section aria-labelledby="top-actions-title">
  <h3 id="top-actions-title">Do these first</h3>
  {#if actions.length === 0}
    <p class="muted">Everything is on track; nothing needs doing yet.</p>
  {:else}
    <ol class="action-list">
      {#each actions as task (task.id)}
        <li class="action">
          <p class="action-title">{task.title}</p>
          <p class="action-meta">
            Due <time datetime={toIso(task.due)}>{shortDay(task.due, plan.today)}</time>
            <TaskBadge status={task.status} idealDue={task.idealDue} today={plan.today} />
          </p>
          <Why reasons={task.reasons} />
        </li>
      {/each}
    </ol>
  {/if}
</section>

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

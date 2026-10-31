<script lang="ts">
  import { PHASES, formatDay, formatLongDay, occasion, type Plan } from '@jashn/core';
  import { PHASE_LABELS } from '../lib/labels.ts';
  import CopyButton from './CopyButton.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    plan: Plan;
    checks: ReadonlySet<string>;
    print: () => void;
  }
  let { plan, checks, print }: Props = $props();

  /** Plain text by phase, with due dates and ticks, readable in any messaging app. */
  function checklistText(): string {
    const when = formatLongDay(plan.today + plan.daysToGo);
    const lines = [`Jashn checklist: ${occasion(plan.input)}, ${when}`];
    for (const phase of PHASES) {
      const tasks = plan.tasks.filter((task) => task.phase === phase);
      if (tasks.length === 0) continue;
      lines.push('', PHASE_LABELS[phase]);
      for (const task of tasks) {
        const done = checks.has(task.id) || task.status === 'done';
        lines.push(`[${done ? 'x' : ' '}] ${task.title} (due ${formatDay(task.due)})`);
      }
    }
    return lines.join('\n');
  }
</script>

<div class="share-bar" role="group" aria-label="Take the plan with you">
  <button type="button" class="button" onclick={print}><Icon name="print" /> Print</button>
  <CopyButton text={checklistText} label="Copy checklist" done="Checklist copied." />
</div>

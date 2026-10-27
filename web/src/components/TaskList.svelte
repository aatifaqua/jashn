<script lang="ts">
  import { PHASES, type Plan, type Task } from '@jashn/core';
  import { isoDay, shortDay } from '../lib/format.ts';
  import { PHASE_LABELS } from '../lib/labels.ts';
  import Icon from './Icon.svelte';
  import TaskBadge from './TaskBadge.svelte';
  import Why from './Why.svelte';

  /** The timeline by phase, with real checkboxes and a calendar export. */
  interface Props {
    plan: Plan;
    planId: string;
    checks: ReadonlySet<string>;
    ontoggle: (taskId: string, done: boolean) => void;
  }
  let { plan, planId, checks, ontoggle }: Props = $props();

  let exportMessage = $state('');

  const phases = $derived(
    PHASES.map((phase) => ({
      phase,
      tasks: plan.tasks.filter((task) => task.phase === phase),
    })).filter((group) => group.tasks.length > 0),
  );

  function isDone(task: Task): boolean {
    return task.status === 'done' || checks.has(task.id);
  }

  /** The calendar writer loads on first use, keeping it out of the plan view's chunk. */
  async function exportCalendar(): Promise<void> {
    try {
      const { downloadCalendar } = await import('../lib/calendar.ts');
      downloadCalendar(plan, planId);
      exportMessage = 'Calendar file downloaded: jashn-timeline.ics.';
    } catch {
      exportMessage = 'Could not create the calendar file. Please try again.';
    }
  }
</script>

<div class="button-row">
  <button type="button" class="button" onclick={() => void exportCalendar()}>
    <Icon name="calendar" /> Add to calendar (.ics)
  </button>
  <p class="muted" role="status">{exportMessage}</p>
</div>

{#each phases as group (group.phase)}
  <section class="phase" aria-labelledby="phase-{group.phase}">
    <h3 id="phase-{group.phase}">{PHASE_LABELS[group.phase]}</h3>
    <ul class="task-list">
      {#each group.tasks as task (task.id)}
        <li class="task" class:task-done={isDone(task)}>
          <label class="check">
            <input
              type="checkbox"
              checked={isDone(task)}
              disabled={task.status === 'done'}
              onchange={(event) => {
                ontoggle(task.id, event.currentTarget.checked);
              }}
            />
            <span>{task.title}</span>
          </label>
          <p class="task-meta">
            Due <time datetime={isoDay(task.due)}>{shortDay(task.due)}</time>
            <TaskBadge status={task.status} idealDue={task.idealDue} today={plan.today} />
          </p>
          <Why reasons={task.reasons} />
        </li>
      {/each}
    </ul>
  </section>
{/each}

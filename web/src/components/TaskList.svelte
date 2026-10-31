<script lang="ts">
  import { PHASES, toIso, type Plan, type Task } from '@jashn/core';
  import { shortDay } from '../lib/format.ts';
  import { PHASE_LABELS } from '../lib/labels.ts';
  import TaskBadge from './TaskBadge.svelte';
  import Why from './Why.svelte';

  /** The timeline by phase, with real checkboxes. */
  interface Props {
    plan: Plan;
    checks: ReadonlySet<string>;
    ontoggle: (taskId: string, done: boolean) => void;
  }
  let { plan, checks, ontoggle }: Props = $props();

  const phases = $derived(
    PHASES.map((phase) => ({
      phase,
      tasks: plan.tasks.filter((task) => task.phase === phase),
    })).filter((group) => group.tasks.length > 0),
  );

  function isDone(task: Task): boolean {
    return task.status === 'done' || checks.has(task.id);
  }
</script>

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
            Due <time datetime={toIso(task.due)}>{shortDay(task.due, plan.today)}</time>
            {#if !isDone(task)}
              <TaskBadge status={task.status} idealDue={task.idealDue} today={plan.today} />
            {/if}
          </p>
          <Why reasons={task.reasons} />
        </li>
      {/each}
    </ul>
  </section>
{/each}

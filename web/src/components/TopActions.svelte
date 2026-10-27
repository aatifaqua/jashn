<script lang="ts">
  import type { Task } from '@jashn/core';
  import { isoDay, shortDay } from '../lib/format.ts';
  import TaskBadge from './TaskBadge.svelte';
  import Why from './Why.svelte';

  /** The first things to do, each with the reasons it made the list. */
  interface Props {
    actions: readonly Task[];
    today: number;
  }
  let { actions, today }: Props = $props();
</script>

<section class="top-actions" aria-labelledby="top-actions-title">
  <h3 id="top-actions-title">Do these first</h3>
  {#if actions.length === 0}
    <p class="muted">Everything is on track; nothing needs doing yet.</p>
  {:else}
    <ol class="action-list">
      {#each actions as task (task.id)}
        <li class="action">
          <p class="action-title">{task.title}</p>
          <p class="action-meta">
            Due <time datetime={isoDay(task.due)}>{shortDay(task.due, today)}</time>
            <TaskBadge status={task.status} idealDue={task.idealDue} {today} />
          </p>
          <Why reasons={task.reasons} />
        </li>
      {/each}
    </ol>
  {/if}
</section>

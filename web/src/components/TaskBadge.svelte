<script lang="ts">
  import { type TaskStatus } from '@jashn/core';
  import { lateByText } from '../lib/format.ts';
  import { TASK_BADGES } from '../lib/labels.ts';
  import Icon from './Icon.svelte';

  /** A task's status as an icon and words; upcoming tasks show nothing. */
  interface Props {
    status: TaskStatus;
    idealDue: number;
    today: number;
  }
  let { status, idealDue, today }: Props = $props();

  const badge = $derived(TASK_BADGES[status]);
  const detail = $derived(status === 'late' ? lateByText(idealDue, today) : '');
</script>

{#if badge !== undefined}
  <span class="badge badge-{status}">
    <Icon name={badge.icon} />
    {detail === '' ? badge.word : detail}
  </span>
{/if}

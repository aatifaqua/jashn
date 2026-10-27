<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * A destructive action that takes two clicks: the first reveals the question and a confirm
   * button (which receives focus), the second acts. Nothing is lost to a stray click.
   */
  interface Props {
    label: string;
    /** Accessible name when the visible label alone is ambiguous (for example in a list). */
    name?: string | undefined;
    question: string;
    confirmLabel: string;
    onconfirm: () => void;
  }
  let { label, name, question, confirmLabel, onconfirm }: Props = $props();

  let asking = $state(false);
  let confirm = $state<HTMLButtonElement>();
  let trigger = $state<HTMLButtonElement>();

  async function ask(): Promise<void> {
    asking = true;
    await tick();
    confirm?.focus();
  }

  /** Cancel removes the focused button, so focus goes back to the button that asked. */
  async function cancel(): Promise<void> {
    asking = false;
    await tick();
    trigger?.focus();
  }
</script>

{#if asking}
  <span class="confirm" role="group" aria-label={question}>
    <span>{question}</span>
    <button
      type="button"
      class="button danger small"
      bind:this={confirm}
      onclick={() => {
        asking = false;
        onconfirm();
      }}>{confirmLabel}</button
    >
    <button type="button" class="button ghost small" onclick={() => void cancel()}>Cancel</button>
  </span>
{:else}
  <button
    type="button"
    class="button ghost small danger-text"
    aria-label={name}
    bind:this={trigger}
    onclick={() => void ask()}
  >
    <Icon name="trash" />
    {label}
  </button>
{/if}

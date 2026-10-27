<script lang="ts">
  import type { Feasibility } from '@jashn/core';
  import { rupees } from '../lib/format.ts';
  import { VERDICTS } from '../lib/labels.ts';
  import Icon from './Icon.svelte';

  /** The budget verdict as icon, word and sentence, so it never relies on colour alone. */
  interface Props {
    feasibility: Feasibility;
  }
  let { feasibility }: Props = $props();

  const verdict = $derived(VERDICTS[feasibility.verdict]);
</script>

<div class="verdict verdict-{feasibility.verdict}">
  <p class="verdict-head">
    <Icon name={verdict.icon} />
    <span>Budget: <strong>{verdict.word}</strong></span>
  </p>
  <p>{verdict.text}</p>
  <p class="muted">
    About {rupees(feasibility.perGuest)} per expected guest; a modest version needs about {rupees(
      feasibility.floor,
    )}.
  </p>
</div>

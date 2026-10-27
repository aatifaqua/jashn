<script lang="ts">
  import type { Plan } from '@jashn/core';
  import { checklistText } from '../lib/checklist.ts';
  import { shareLink } from '../lib/share.ts';
  import CopyButton from './CopyButton.svelte';
  import Icon from './Icon.svelte';

  /** Ways to take the plan away: print, copy the checklist, copy a share link. */
  interface Props {
    plan: Plan;
    checks: ReadonlySet<string>;
    page: Pick<Location, 'origin' | 'pathname'>;
    print: () => void;
  }
  let { plan, checks, page, print }: Props = $props();
</script>

<div class="share-bar" role="group" aria-label="Take the plan with you">
  <button type="button" class="button" onclick={print}><Icon name="print" /> Print</button>
  <CopyButton
    text={() => checklistText(plan, checks)}
    label="Copy checklist"
    done="Checklist copied."
  />
  <CopyButton
    text={() => shareLink(plan.input, page)}
    label="Copy share link"
    done="Link copied. It holds the event details, never your progress."
    icon="link"
  />
</div>

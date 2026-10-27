<script lang="ts">
  import { copyText } from '../lib/clipboard.ts';
  import Icon from './Icon.svelte';
  import type { IconName } from '../lib/icons.ts';

  /** Copies text and reports the outcome in a polite status message beside the button. */
  interface Props {
    text: () => string;
    label: string;
    done: string;
    icon?: IconName;
  }
  let { text, label, done, icon = 'copy' }: Props = $props();

  let message = $state('');

  async function copy(): Promise<void> {
    message = (await copyText(text())) ? done : 'Copying is blocked here; select the text instead.';
  }
</script>

<span class="copy">
  <button type="button" class="button" onclick={() => void copy()}>
    <Icon name={icon} />
    {label}
  </button>
  <span class="muted" role="status">{message}</span>
</span>

<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';

  /** Copies text and reports the outcome in a polite status message beside the button. */
  interface Props {
    text: () => string;
    label: string;
    done: string;
  }
  let { text, label, done }: Props = $props();

  let message = $state('');

  /**
   * The status is cleared first, so a second copy is announced again. The Clipboard API is
   * missing or denied on insecure origins and some embedded views, which the message says.
   */
  async function copy(): Promise<void> {
    message = '';
    let copied = true;
    try {
      await navigator.clipboard.writeText(text());
    } catch {
      copied = false;
    }
    await tick();
    message = copied ? done : 'Copying is blocked here; select the text instead.';
  }
</script>

<span class="copy">
  <button type="button" class="button" onclick={() => void copy()}>
    <Icon name="copy" />
    {label}
  </button>
  <span class="muted" role="status">{message}</span>
</span>

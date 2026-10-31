<script lang="ts">
  import type { Source } from '@jashn/core';
  import Icon from './Icon.svelte';

  /** Labels generated content with where it came from. */
  interface Props {
    source: Source;
  }
  let { source }: Props = $props();
</script>

<span class="badge badge-source">
  <Icon name={source === 'gemini' ? 'spark' : 'info'} />
  {source === 'gemini' ? 'Written by Gemini' : 'Offline suggestion'}
</span>

<script lang="ts">
  import type { IconName } from '../lib/icons.ts';

  /** An icon from the inline sprite; decorative, so the text next to it carries the meaning. */
  interface Props {
    name: IconName;
  }
  let { name }: Props = $props();
</script>

<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-{name}"></use></svg>

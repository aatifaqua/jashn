<script lang="ts" module>
  /** Symbols in the inline sprite in index.html: in the first paint, with no icon library. */
  export const ICON_NAMES = [
    'check',
    'alert',
    'stop',
    'clock',
    'copy',
    'print',
    'spark',
    'send',
    'sun',
    'moon',
    'trash',
    'info',
  ] as const;

  export type IconName = (typeof ICON_NAMES)[number];
</script>

<script lang="ts">
  /** Decorative, so the text next to it carries the meaning. */
  let { name }: { name: IconName } = $props();
</script>

<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-{name}"></use></svg>

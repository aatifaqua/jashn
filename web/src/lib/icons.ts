/**
 * Names of the symbols in the inline icon sprite (components/IconSprite.svelte). One sprite
 * referenced with <use> keeps every icon in the first paint without an icon library or an
 * extra request.
 */
export const ICON_NAMES = [
  'check',
  'alert',
  'stop',
  'clock',
  'calendar',
  'copy',
  'print',
  'link',
  'spark',
  'send',
  'sun',
  'moon',
  'trash',
  'info',
] as const;

/** One icon in the sprite. */
export type IconName = (typeof ICON_NAMES)[number];

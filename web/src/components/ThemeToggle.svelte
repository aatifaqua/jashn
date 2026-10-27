<script lang="ts">
  import { currentTheme, setTheme, type Theme } from '../lib/theme.ts';
  import Icon from './Icon.svelte';

  /** A pressed/unpressed toggle for the dark theme; the choice is remembered in this browser. */
  interface Props {
    storage: Storage | null;
    root: HTMLElement;
  }
  let { storage, root }: Props = $props();

  function initial(): Theme {
    return currentTheme(storage);
  }

  let theme = $state(initial());

  function toggle(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme, storage, root);
  }
</script>

<button type="button" class="button ghost" aria-pressed={theme === 'dark'} onclick={toggle}>
  <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
  Dark theme
</button>

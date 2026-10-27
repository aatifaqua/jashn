<script lang="ts">
  import Icon from './Icon.svelte';

  /** An inline field error, referenced by the field's aria-describedby as `<field>-error`. */
  interface Props {
    field: string;
    message: string | undefined;
  }
  let { field, message }: Props = $props();
</script>

{#if message !== undefined}
  <p class="field-error" id="{field}-error"><Icon name="alert" /> {message}</p>
{/if}

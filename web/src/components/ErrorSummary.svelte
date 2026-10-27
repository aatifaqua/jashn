<script lang="ts">
  import { FIELD_LABELS, type FieldError, type InputField } from '@jashn/core';

  /**
   * Lists every form error with a link to its field. The parent focuses `element` after a failed
   * submit, so keyboard and screen-reader users land on the list of what to fix.
   */
  interface Props {
    errors: readonly FieldError[];
    element?: HTMLElement | undefined;
  }
  let { errors, element = $bindable() }: Props = $props();

  /**
   * Moves focus to the field's first control. Grouped fields (radios, checkboxes) have no
   * element with the link's id, so the default jump is replaced by focusing the first control.
   */
  function jump(event: MouseEvent, field: InputField | 'patch'): void {
    event.preventDefault();
    element?.closest('form')?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }
</script>

{#if errors.length > 0}
  <div
    class="error-summary"
    tabindex="-1"
    bind:this={element}
    aria-labelledby="error-summary-title"
  >
    <h2 id="error-summary-title">
      Please fix {errors.length === 1 ? 'this' : 'these'} before planning
    </h2>
    <ul>
      {#each errors as error (error.field + error.code)}
        <li>
          <a
            href="#f-{error.field}"
            onclick={(event) => {
              jump(event, error.field);
            }}
          >
            {error.field === 'patch'
              ? error.message
              : `${FIELD_LABELS[error.field]}: ${error.message}`}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

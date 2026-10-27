<script lang="ts">
  import { CONSTRAINTS, INPUT_LIMITS, type Profile } from '@jashn/core';
  import { blankForm, describedBy, type FieldErrors, type FormState } from '../lib/form.ts';
  import { CONSTRAINT_LABELS } from '../lib/labels.ts';
  import FieldError from './FieldError.svelte';

  /** Step 3 of the form: budget, priorities, needs and the free-text note. */
  interface Props {
    form?: FormState;
    profile: Profile | null;
    errors: FieldErrors;
  }
  let { form = $bindable(blankForm()), profile, errors }: Props = $props();

  const full = $derived(form.priorities.length >= INPUT_LIMITS.maxPriorities);
</script>

<fieldset class="step">
  <legend><span class="step-no" aria-hidden="true">3</span> Money and needs</legend>

  <div class="field">
    <label for="f-budget">Total budget (₹)</label>
    <input
      id="f-budget"
      name="budget"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      bind:value={form.budget}
      aria-invalid={errors.budget !== undefined}
      aria-describedby={describedBy('budget', errors, true)}
    />
    <p class="hint" id="budget-hint">Whole rupees, for example 16,00,000.</p>
    <FieldError field="budget" message={errors.budget} />
  </div>

  {#if profile !== null && profile.type === form.type}
    <fieldset class="group" aria-describedby={describedBy('priorities', errors, true)}>
      <legend>Priorities</legend>
      <p class="hint" id="priorities-hint">Up to two; each gets a bigger share of the budget.</p>
      <div class="choice-row">
        {#each profile.categories as category (category.id)}
          <label class="chip-choice">
            <input
              type="checkbox"
              name="priorities"
              value={category.id}
              bind:group={form.priorities}
              disabled={full && !form.priorities.includes(category.id)}
            />
            {category.label}
          </label>
        {/each}
      </div>
      <FieldError field="priorities" message={errors.priorities} />
    </fieldset>
  {/if}

  <fieldset class="group" aria-describedby={describedBy('constraints', errors, true)}>
    <legend>Needs</legend>
    <p class="hint" id="constraints-hint">Each one changes the plan: menus, questions and tasks.</p>
    <div class="choice-row">
      {#each CONSTRAINTS as constraint (constraint)}
        <label class="chip-choice">
          <input
            type="checkbox"
            name="constraints"
            value={constraint}
            bind:group={form.constraints}
          />
          {CONSTRAINT_LABELS[constraint]}
        </label>
      {/each}
    </div>
    <FieldError field="constraints" message={errors.constraints} />
  </fieldset>

  <div class="field">
    <label for="f-note">Anything else (optional)</label>
    <textarea
      id="f-note"
      name="note"
      rows="3"
      maxlength={INPUT_LIMITS.noteMax}
      bind:value={form.note}
      aria-invalid={errors.note !== undefined}
      aria-describedby={describedBy('note', errors, true)}></textarea>
    <p class="hint" id="note-hint">
      Up to {INPUT_LIMITS.noteMax} characters ({form.note.length} used). Please leave out names, phone
      numbers and addresses.
    </p>
    <FieldError field="note" message={errors.note} />
  </div>
</fieldset>

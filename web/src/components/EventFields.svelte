<script lang="ts">
  import {
    EVENT_TYPES,
    INPUT_LIMITS,
    addYears,
    toIso,
    type EventType,
    type Profile,
    type StyleDef,
  } from '@jashn/core';
  import { blankForm, describedBy, type FieldErrors, type FormState } from '../lib/form.ts';
  import { TYPE_LABELS } from '../lib/labels.ts';
  import FieldError from './FieldError.svelte';

  /** Step 1 of the form: what the event is and when it happens. */
  interface Props {
    form?: FormState;
    profile: Profile | null;
    errors: FieldErrors;
    today: number;
    onType: (type: EventType) => void;
    onStyle: (style: StyleDef) => void;
  }
  let { form = $bindable(blankForm()), profile, errors, today, onType, onStyle }: Props = $props();

  const minDate = $derived(toIso(today));
  const maxDate = $derived(toIso(addYears(today, INPUT_LIMITS.maxLeadYears)));
</script>

<fieldset class="step">
  <legend><span class="step-no" aria-hidden="true">1</span> The event</legend>

  <fieldset class="group" aria-describedby={describedBy('type', errors)}>
    <legend>Type of event</legend>
    <div class="choice-cards">
      {#each EVENT_TYPES as type (type)}
        <label class="choice-card">
          <input
            type="radio"
            name="type"
            value={type}
            bind:group={form.type}
            onchange={() => {
              onType(type);
            }}
          />
          <span class="choice-title">{TYPE_LABELS[type].label}</span>
          <span class="choice-hint">{TYPE_LABELS[type].hint}</span>
        </label>
      {/each}
    </div>
    <FieldError field="type" message={errors.type} />
  </fieldset>

  {#if profile?.type !== form.type}
    <p class="muted" role="status">Loading the choices for this event…</p>
  {:else}
    <fieldset class="group" aria-describedby={describedBy('style', errors)}>
      <legend>Style</legend>
      <div class="choice-row">
        {#each profile.styles as style (style.id)}
          <label class="chip-choice">
            <input
              type="radio"
              name="style"
              value={style.id}
              checked={form.style === style.id}
              onchange={() => {
                onStyle(style);
              }}
            />
            {style.label}
          </label>
        {/each}
      </div>
      <FieldError field="style" message={errors.style} />
    </fieldset>

    {#if profile.functions.length > 0}
      <fieldset class="group" aria-describedby={describedBy('functions', errors, true)}>
        <legend>Functions</legend>
        <p class="hint" id="functions-hint">The ceremony is always included.</p>
        <div class="choice-row">
          {#each profile.functions as fn (fn.id)}
            <label class="chip-choice">
              <input
                type="checkbox"
                name="functions"
                value={fn.id}
                bind:group={form.functions}
                disabled={fn.id === 'ceremony'}
              />
              {fn.label}
            </label>
          {/each}
        </div>
        <FieldError field="functions" message={errors.functions} />
      </fieldset>
    {/if}
  {/if}

  <div class="field-row">
    <div class="field">
      <label for="f-date">Date</label>
      <input
        id="f-date"
        name="date"
        type="date"
        min={minDate}
        max={maxDate}
        bind:value={form.date}
        aria-invalid={errors.date !== undefined}
        aria-describedby={describedBy('date', errors)}
      />
      <FieldError field="date" message={errors.date} />
    </div>
    <div class="field">
      <label for="f-startTime">Start time</label>
      <input
        id="f-startTime"
        name="startTime"
        type="time"
        bind:value={form.startTime}
        aria-invalid={errors.startTime !== undefined}
        aria-describedby={describedBy('startTime', errors, true)}
      />
      <p class="hint" id="startTime-hint">Set from the style; change it if yours differs.</p>
      <FieldError field="startTime" message={errors.startTime} />
    </div>
  </div>
</fieldset>

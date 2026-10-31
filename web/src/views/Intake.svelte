<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    SAMPLE_IDS,
    buildPlan,
    sampleEvent,
    sampleLabel,
    validateInput,
    type EventType,
    type FieldError,
    type Plan,
    type Profile,
    type SampleId,
    type StyleDef,
  } from '@jashn/core';
  import EventFields from '../components/EventFields.svelte';
  import ErrorSummary from '../components/ErrorSummary.svelte';
  import LiveSummary from '../components/LiveSummary.svelte';
  import MoneyFields from '../components/MoneyFields.svelte';
  import PlaceFields from '../components/PlaceFields.svelte';
  import { debounce } from '../lib/debounce.ts';
  import {
    blankForm,
    errorsByField,
    formFrom,
    formToRaw,
    withStyle,
    withType,
    type FormState,
  } from '../lib/form.ts';
  import type { PlanStore } from '../lib/plans.svelte.ts';
  import { planDay } from '../lib/storage.ts';

  /** The start screen and the edit form: samples and the three-step form. */
  interface Props {
    store: PlanStore;
    /** True when editing the open plan's details instead of starting a new plan. */
    editing: boolean;
    /** Move focus to the heading on mount (after navigating here, not on first load). */
    focusHeading: boolean;
    ondone: () => void;
    oncancel: () => void;
  }
  let { store, editing, focusHeading, ondone, oncancel }: Props = $props();

  /** Short enough to feel live, long enough to skip the work between keystrokes. */
  const SUMMARY_DELAY_MS = 150;

  function initialForm(): FormState {
    const input = editing ? store.input : null;
    return input === null ? blankForm() : formFrom(input);
  }

  let form = $state(initialForm());
  let profile = $state.raw<Profile | null>(null);
  let errors = $state.raw<readonly FieldError[]>([]);
  let attempted = $state(false);
  let summary = $state.raw<Plan | null>(null);
  let busy = $state(false);
  let heading = $state<HTMLElement>();
  let errorSummary = $state<HTMLElement>();

  const fieldErrors = $derived(errorsByField(errors));

  /**
   * The day the form validates against: today, or for an event that has already been held, its
   * own day, so its budget or headcount can still be corrected without moving the date.
   */
  function validDay(): number {
    const input = editing ? store.input : null;
    return input === null ? store.today : planDay(input, store.today);
  }

  /** Validates the form and refreshes the live summary (and, after a failed submit, the errors). */
  const recompute = debounce((raw: Record<string, unknown>) => {
    const day = validDay();
    const result = validateInput(raw, day);
    if (attempted) errors = result.ok ? [] : result.errors;
    summary =
      result.ok && profile?.type === result.value.type
        ? buildPlan(result.value, day, profile)
        : null;
  }, SUMMARY_DELAY_MS);

  $effect(() => {
    recompute.run(formToRaw($state.snapshot(form)));
  });

  onMount(() => {
    void useType(form.type);
    if (focusHeading) heading?.focus();
    return () => {
      recompute.cancel();
    };
  });

  /**
   * Loads the profile for the form's type. A reply for a type the user has since left is
   * ignored (last choice wins); type-specific choices reset only when they do not fit the
   * loaded type, so an edited plan keeps its style, functions and priorities.
   */
  async function useType(type: EventType): Promise<void> {
    const loaded = await store.fetchProfile(type);
    if (loaded === null || form.type !== type) return;
    profile = loaded;
    if (!loaded.styles.some((style) => style.id === form.style)) form = withType(form, loaded);
    recompute.run(formToRaw($state.snapshot(form)));
  }

  function chooseStyle(style: StyleDef): void {
    form = withStyle(form, style);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    attempted = true;
    const result = validateInput(formToRaw(form), validDay());
    if (!result.ok) {
      errors = result.errors;
      await tick();
      errorSummary?.focus();
      return;
    }
    errors = [];
    busy = true;
    const ok = editing ? await store.edit(result.value) : await store.create(result.value);
    busy = false;
    if (ok) ondone();
  }

  async function pickSample(id: SampleId): Promise<void> {
    busy = true;
    const created = await store.create(sampleEvent(id, store.today));
    busy = false;
    if (created) ondone();
  }

  /** Repeats what failed: creating or saving a plan, else loading the form's type. */
  async function tryAgain(): Promise<void> {
    const retried = await store.retry();
    if (retried === null) await useType(form.type);
    else if (retried) ondone();
  }
</script>

<div class="intake">
  <div class="intake-intro">
    <h1 tabindex="-1" bind:this={heading}>
      {editing ? 'Edit your event' : 'Plan your celebration'}
    </h1>
    <p class="lede">
      Describe your wedding, birthday or community event once. Jashn works out a realistic budget
      split, a dated timeline, a vendor checklist, a day-of run sheet and ideas that respect your
      needs.
    </p>
  </div>

  {#if !editing}
    <section class="samples" aria-labelledby="samples-title">
      <h2 id="samples-title">Try a sample</h2>
      <ul class="chip-list">
        {#each SAMPLE_IDS as id (id)}
          <li>
            <button type="button" class="chip" disabled={busy} onclick={() => void pickSample(id)}>
              {sampleLabel(id)}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if store.error !== null}
    <div class="notice notice-bad" role="alert">
      <p>{store.error}</p>
      <button type="button" class="button small" onclick={() => void tryAgain()}>
        Try again
      </button>
    </div>
  {/if}

  <div class="intake-grid">
    <form class="intake-form" novalidate onsubmit={submit} aria-labelledby="form-title">
      <h2 id="form-title">{editing ? 'Event details' : 'Describe your event'}</h2>
      <ErrorSummary {errors} bind:element={errorSummary} />
      <EventFields
        bind:form
        {profile}
        errors={fieldErrors}
        today={store.today}
        onType={(type: EventType) => void useType(type)}
        onStyle={chooseStyle}
      />
      <PlaceFields bind:form errors={fieldErrors} />
      <MoneyFields bind:form {profile} errors={fieldErrors} />
      <div class="button-row">
        <button type="submit" class="button primary" aria-busy={busy} disabled={busy}>
          {editing ? 'Update my plan' : 'Make my plan'}
        </button>
        {#if editing}
          <button type="button" class="button ghost" onclick={oncancel}>Cancel</button>
        {/if}
      </div>
    </form>
    <LiveSummary plan={summary} />
  </div>
</div>

<script lang="ts">
  import { CITY_TIERS, INPUT_LIMITS, SETTINGS } from '@jashn/core';
  import { blankForm, describedBy, type FieldErrors, type FormState } from '../lib/form.ts';
  import { SETTING_LABELS, TIER_LABELS } from '../lib/labels.ts';
  import FieldError from './FieldError.svelte';

  /** Step 2 of the form: where the event is and how many people are invited. */
  interface Props {
    form?: FormState;
    errors: FieldErrors;
  }
  let { form = $bindable(blankForm()), errors }: Props = $props();
</script>

<fieldset class="step">
  <legend><span class="step-no" aria-hidden="true">2</span> Place and people</legend>

  <div class="field-row">
    <div class="field">
      <label for="f-city">City</label>
      <input
        id="f-city"
        name="city"
        type="text"
        autocomplete="address-level2"
        maxlength={INPUT_LIMITS.cityMax}
        bind:value={form.city}
        aria-invalid={errors.city !== undefined}
        aria-describedby={describedBy('city', errors, true)}
      />
      <p class="hint" id="city-hint">Used only to personalise ideas.</p>
      <FieldError field="city" message={errors.city} />
    </div>
    <div class="field">
      <label for="f-tier">City size</label>
      <select
        id="f-tier"
        name="tier"
        bind:value={form.tier}
        aria-describedby={describedBy('tier', errors, true)}
      >
        {#each CITY_TIERS as tier (tier)}
          <option value={tier}>{TIER_LABELS[tier]}</option>
        {/each}
      </select>
      <p class="hint" id="tier-hint">Costs differ most between city sizes.</p>
      <FieldError field="tier" message={errors.tier} />
    </div>
  </div>

  <fieldset class="group" aria-describedby={describedBy('setting', errors)}>
    <legend>Setting</legend>
    <div class="choice-row">
      {#each SETTINGS as setting (setting)}
        <label class="chip-choice">
          <input type="radio" name="setting" value={setting} bind:group={form.setting} />
          {SETTING_LABELS[setting]}
        </label>
      {/each}
    </div>
    <FieldError field="setting" message={errors.setting} />
  </fieldset>

  <div class="field-row">
    <div class="field">
      <label for="f-invited">Guests invited</label>
      <input
        id="f-invited"
        name="invited"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        bind:value={form.invited}
        aria-invalid={errors.invited !== undefined}
        aria-describedby={describedBy('invited', errors, true)}
      />
      <p class="hint" id="invited-hint">
        1 to 5,000. Jashn estimates how many will come from this.
      </p>
      <FieldError field="invited" message={errors.invited} />
    </div>
    <div class="field field-check">
      <label class="check">
        <input type="checkbox" name="venueBooked" bind:checked={form.venueBooked} />
        The venue is already booked
      </label>
    </div>
  </div>
</fieldset>

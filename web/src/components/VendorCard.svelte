<script lang="ts">
  import {
    VENDOR_STATUSES,
    formatRupees,
    toIso,
    type Draft,
    type Payment,
    type Plan,
    type Sourced,
    type VendorItem,
    type VendorStatus,
  } from '@jashn/core';
  import type { GenAi } from '../lib/genai.ts';
  import { shortDay } from '../lib/format.ts';
  import { VENDOR_STATUS_LABELS } from '../lib/labels.ts';
  import { isVendorStatus } from '../lib/validate.ts';
  import CopyButton from './CopyButton.svelte';
  import Icon from './Icon.svelte';
  import SourceBadge from './SourceBadge.svelte';
  import Why from './Why.svelte';

  /** One vendor: book-by date, progress, questions to ask, payments and an enquiry draft. */
  interface Props {
    vendor: VendorItem;
    plan: Plan;
    status: VendorStatus;
    genai: GenAi;
    onstatus: (status: VendorStatus) => void;
  }
  let { vendor, plan, status, genai, onstatus }: Props = $props();

  /** The draft and the plan it was written for; a draft for older details is not shown. */
  let drafted = $state.raw<{ plan: Plan; draft: Sourced<Draft> } | null>(null);
  const draft = $derived(drafted?.plan === plan ? drafted.draft : null);
  let busy = $state(false);

  const payments: readonly Payment[] = $derived(
    plan.payments.filter((payment) => payment.vendorId === vendor.id),
  );
  const statusId = $derived(`vendor-status-${vendor.id}`);

  /** A paid vendor's deposit and balance are settled, so they are shown as paid, not due. */
  const settled = $derived(status === 'paid');

  async function makeDraft(): Promise<void> {
    // The button stays focusable while busy (aria-disabled), so a second press lands here.
    if (busy) return;
    busy = true;
    const base = plan;
    drafted = { plan: base, draft: await genai.draft(base, vendor) };
    busy = false;
  }
</script>

<article class="vendor card" aria-labelledby="vendor-{vendor.id}">
  <header class="vendor-head">
    <h3 id="vendor-{vendor.id}">{vendor.label}</h3>
    <p class="muted">
      {#if vendor.booked}
        <Icon name="check" /> Already booked
      {:else}
        Book by <time datetime={toIso(vendor.bookBy)}>{shortDay(vendor.bookBy, plan.today)}</time>
      {/if}
    </p>
  </header>

  <div class="field field-inline">
    <label for={statusId}>Progress</label>
    <select
      id={statusId}
      value={status}
      onchange={(event) => {
        const next = event.currentTarget.value;
        if (isVendorStatus(next)) onstatus(next);
      }}
    >
      {#each VENDOR_STATUSES as option (option)}
        <option value={option}>{VENDOR_STATUS_LABELS[option]}</option>
      {/each}
    </select>
  </div>

  <h4>Questions to ask</h4>
  <ul class="questions">
    {#each vendor.questions as question, index (index)}
      <li>{question}</li>
    {/each}
  </ul>

  {#if payments.length > 0}
    <h4>Payments</h4>
    <ul class="payments">
      {#each payments as payment (payment.kind)}
        <li>
          {payment.kind === 'deposit' ? 'Deposit' : 'Balance'}
          {formatRupees(payment.amount)}
          {#if settled}
            <span class="badge badge-done"><Icon name="check" /> Paid</span>
          {:else}
            by <time datetime={toIso(payment.due)}>{shortDay(payment.due, plan.today)}</time>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <Why reasons={vendor.reasons} />

  <div class="button-row">
    <button
      type="button"
      class="button"
      aria-busy={busy}
      aria-disabled={busy}
      onclick={() => void makeDraft()}
    >
      <Icon name="spark" />
      {draft === null ? 'Draft enquiry' : 'Draft again'}
    </button>
    <!-- Only this short line is live; the draft itself is read when the user moves to it. -->
    <p class="muted" role="status">
      {busy ? 'Drafting…' : draft === null ? '' : 'Draft ready below.'}
    </p>
  </div>
  {#if draft !== null}
    {@const text = draft.text}
    <div class="draft">
      <SourceBadge source={draft.source} />
      <p class="draft-text">{text}</p>
      <CopyButton text={() => text} label="Copy message" done="Message copied." />
    </div>
  {/if}
</article>

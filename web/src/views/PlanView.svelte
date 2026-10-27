<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { EventInput, Language, Plan, PlanPatch, Profile, VendorStatus } from '@jashn/core';
  import Assistant from '../components/Assistant.svelte';
  import BudgetChart from '../components/BudgetChart.svelte';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Icon from '../components/Icon.svelte';
  import IdeasPanel from '../components/IdeasPanel.svelte';
  import Overview from '../components/Overview.svelte';
  import RunSheet from '../components/RunSheet.svelte';
  import ShareBar from '../components/ShareBar.svelte';
  import TaskList from '../components/TaskList.svelte';
  import TrimList from '../components/TrimList.svelte';
  import VendorCard from '../components/VendorCard.svelte';
  import { longDay } from '../lib/format.ts';
  import { defaultGenAi, type GenAi } from '../lib/genai.ts';
  import { eventTitle } from '../lib/labels.ts';
  import type { PlanStore } from '../lib/plans.svelte.ts';
  import type { SavedIdeas, SavedPlan } from '../lib/storage.ts';
  import { PLAN_TABS, tabIndexForKey, type PlanTabId } from '../lib/tabs.ts';

  /**
   * The plan, loaded lazily after the form. Every tab panel stays in the page (inactive ones
   * hidden) so printing produces the whole plan and the assistant keeps its place across tabs.
   */
  interface Props {
    store: PlanStore;
    entry: SavedPlan;
    plan: Plan;
    profile: Profile;
    genai?: GenAi | undefined;
    focusHeading: boolean;
    page: Pick<Location, 'origin' | 'pathname'>;
    print: () => void;
    onedit: () => void;
  }
  let { store, entry, plan, profile, genai, focusHeading, page, print, onedit }: Props = $props();

  let active = $state<PlanTabId>('overview');
  let heading = $state<HTMLElement>();

  /** The generative client and its fallback catalogues load with this view, not the start screen. */
  const client = $derived(genai ?? defaultGenAi());
  const checks = $derived(new Set(entry.checks));
  /** Category, function and style ids in words, from the loaded profile. */
  const labels = $derived(
    new Map<string, string>([
      ...profile.categories.map((item) => [item.id, item.label] as const),
      ...profile.functions.map((item) => [item.id, item.label] as const),
      ...profile.styles.map((item) => [item.id, item.label] as const),
    ]),
  );
  const labelOf = (id: string): string => labels.get(id) ?? id;

  onMount(() => {
    if (focusHeading) heading?.focus();
  });

  /** Click and Enter select a tab and move focus to its panel heading. */
  async function open(id: PlanTabId): Promise<void> {
    active = id;
    await tick();
    document.getElementById(`panel-title-${id}`)?.focus();
  }

  /** Arrow keys, Home and End select and focus another tab (roving tabindex). */
  function onKey(event: KeyboardEvent, index: number): void {
    const next = tabIndexForKey(event.key, index, PLAN_TABS.length);
    const tab = next === null ? undefined : PLAN_TABS[next];
    if (tab === undefined) return;
    event.preventDefault();
    active = tab.id;
    document.getElementById(`tab-${tab.id}`)?.focus();
  }
</script>

<article class="plan-view">
  <header class="plan-head">
    <h1 tabindex="-1" bind:this={heading}>{eventTitle(plan.input)}</h1>
    <p class="muted">{longDay(plan.today + plan.daysToGo)} · starts {plan.input.startTime}</p>
    <div class="button-row no-print">
      <button type="button" class="button ghost" onclick={onedit}>Edit details</button>
      <button
        type="button"
        class="button ghost"
        onclick={() => {
          store.close();
        }}
      >
        All plans
      </button>
      <ConfirmButton
        label="Delete this plan"
        question="Delete this plan and its progress?"
        confirmLabel="Yes, delete"
        onconfirm={() => {
          store.remove(entry.id);
        }}
      />
    </div>
    <ShareBar {plan} {checks} {page} {print} />
    {#if client.mode === 'demo'}
      <p class="notice">
        <Icon name="info" /> Demo mode: no live AI here. Sample events use saved Gemini examples where
        available; everything else comes from the offline planner, labelled as such.
      </p>
    {/if}
  </header>

  <div class="plan-body">
    <div class="plan-main">
      <div class="tablist no-print" role="tablist" aria-label="Plan sections">
        {#each PLAN_TABS as tab, index (tab.id)}
          <button
            type="button"
            role="tab"
            id="tab-{tab.id}"
            aria-selected={active === tab.id}
            aria-controls="panel-{tab.id}"
            tabindex={active === tab.id ? 0 : -1}
            onclick={() => void open(tab.id)}
            onkeydown={(event) => {
              onKey(event, index);
            }}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      {#each PLAN_TABS as tab (tab.id)}
        <div
          class="panel"
          role="tabpanel"
          id="panel-{tab.id}"
          aria-labelledby="tab-{tab.id}"
          hidden={active !== tab.id}
        >
          <h2 id="panel-title-{tab.id}" tabindex="-1">{tab.label}</h2>
          {#if tab.id === 'overview'}
            <Overview {plan} {checks} today={store.today} />
          {:else if tab.id === 'budget'}
            <BudgetChart
              lines={plan.budget}
              contingency={plan.contingency}
              total={plan.input.budget}
              {labelOf}
            />
            <TrimList trims={plan.feasibility.trims} />
          {:else if tab.id === 'timeline'}
            <TaskList
              {plan}
              planId={entry.id}
              {checks}
              ontoggle={(id: string, done: boolean) => {
                store.setTask(id, done);
              }}
            />
          {:else if tab.id === 'vendors'}
            <div class="vendor-grid">
              {#each plan.vendors as vendor (vendor.id)}
                <VendorCard
                  {vendor}
                  {plan}
                  genai={client}
                  status={entry.vendors[vendor.id] ?? (vendor.booked ? 'booked' : 'to-contact')}
                  onstatus={(status: VendorStatus) => {
                    store.setVendorStatus(vendor.id, status);
                  }}
                />
              {/each}
            </div>
          {:else if tab.id === 'day-of'}
            <RunSheet slots={plan.runSheet} />
          {:else}
            <IdeasPanel
              {plan}
              genai={client}
              saved={entry.ideas}
              onideas={(ideas: SavedIdeas, forInput: EventInput) => {
                store.setIdeas(ideas, forInput);
              }}
              onlanguage={(language: Language) => {
                store.setLanguage(language);
              }}
            />
          {/if}
        </div>
      {/each}
    </div>
    <Assistant
      {plan}
      {profile}
      genai={client}
      {labelOf}
      onapply={(patch: PlanPatch) => {
        store.applyChange(patch);
      }}
    />
  </div>
</article>

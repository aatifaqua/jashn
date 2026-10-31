<script lang="ts">
  import { onMount } from 'svelte';
  import { indiaDay } from '@jashn/core';
  import Icon from './components/Icon.svelte';
  import Intake from './views/Intake.svelte';
  import type PlanViewComponent from './views/PlanView.svelte';
  import type { GenAi } from './lib/genai.ts';
  import { PlanStore } from './lib/plans.svelte.ts';
  import { STORAGE_KEY, browserStorage } from './lib/storage.ts';
  import { currentTheme, setTheme } from './lib/theme.ts';

  interface Props {
    storage?: Storage | null;
    store?: PlanStore;
    /** Injected in tests; the Plan view creates the real client inside its own chunk. */
    genai?: GenAi;
  }
  let props: Props = $props();

  function setup(): { storage: Storage | null; store: PlanStore } {
    const storage = props.storage === undefined ? browserStorage() : props.storage;
    return {
      storage,
      store: props.store ?? new PlanStore({ storage, today: indiaDay(Date.now()) }),
    };
  }

  const { storage, store } = setup();
  let theme = $state(currentTheme(storage));

  function toggleTheme(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme, storage, document.documentElement);
  }

  /**
   * The Plan view is its own chunk, fetched the first time a plan is shown and then kept, so
   * the start screen never waits for it and returning to a plan never shows a loading state.
   */
  let PlanView = $state.raw<typeof PlanViewComponent | null>(null);
  let planViewFailed = $state(false);
  let planViewLoading = false;

  function loadPlanView(): void {
    if (planViewLoading || PlanView !== null) return;
    planViewLoading = true;
    import('./views/PlanView.svelte').then(
      (module) => {
        PlanView = module.default;
      },
      () => {
        planViewFailed = true;
        planViewLoading = false;
      },
    );
  }

  let editing = $state(false);
  let navigated = $state(false);

  const showPlan = $derived(store.current !== null && !editing);

  $effect(() => {
    if (showPlan) loadPlanView();
  });

  /** Loads the saved plan's planner; also the "Try again" after a failed load. */
  function openSaved(): void {
    planViewFailed = false;
    loadPlanView();
    void store.open();
  }

  onMount(() => {
    if (store.current !== null) void store.open();
    const onHide = (): void => {
      store.flush();
    };
    // A tab left open past midnight moves to the new day when it is shown again.
    const onShow = (): void => {
      if (document.visibilityState === 'visible') store.setToday(indiaDay(Date.now()));
    };
    // Another tab saved the plan: read it, so this tab never writes a stale copy over it.
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY || event.key === null) void store.reload();
    };
    addEventListener('pagehide', onHide);
    addEventListener('pageshow', onShow);
    addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      removeEventListener('pagehide', onHide);
      removeEventListener('pageshow', onShow);
      removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onShow);
    };
  });

  /** Leaves a plan that cannot load for the form, so a failed chunk never traps the user. */
  function startOver(): void {
    planViewFailed = false;
    store.clear();
    navigated = true;
  }

  function done(): void {
    editing = false;
    navigated = true;
  }
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="brand">
    <!-- Decorative: the word "Jashn" sits beside the mark. -->
    <svg class="logo-mark" viewBox="0 0 255.8 227.7" aria-hidden="true" focusable="false">
      <path
        class="logo-back"
        d="M53.4 0H219c20.3 0 36.8 16.5 36.8 36.8V191c0 20.3-16.5 36.8-36.8 36.8H53.4c-20.3 0-36.8-16.5-36.8-36.8V36.8C16.7 16.5 33.1 0 53.4 0z"
      ></path>
      <path
        class="logo-tag"
        d="M16.7 106.8V36c0-19.9 16.1-36 36-36h167.2c19.9 0 36 16.1 36 36v120.6c0 19.9-16.1 36-36 36H36c-12.1 0-23.3-6-30-16.1c-7.2-10.9-8-24.8-2-36.4l8.6-16.6c2.7-5.3 4.1-10.9 4.1-16.7z"
      ></path>
      <path
        class="logo-tick"
        d="M132.6 99.5l40-50c5.7-7.1 16.1-8.3 23.2-2.6c7.1 5.7 8.3 16.1 2.6 23.2L148 133c-11.4 14.2-32.1 16.5-46.3 5.2l-25-20c-7.1-5.7-8.3-16.1-2.6-23.2c5.7-7.1 16.1-8.3 23.2-2.6l12.1 9.7c7.1 5.7 17.5 4.5 23.2-2.6z"
      ></path>
    </svg>
    <span class="brand-name">Jashn</span>
    <span class="brand-tag">Celebration planner</span>
  </div>
  <button type="button" class="button ghost" aria-pressed={theme === 'dark'} onclick={toggleTheme}>
    <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
    Dark theme
  </button>
</header>

<main id="main" tabindex="-1">
  {#if !store.persisted}
    <p class="notice" role="status">
      This browser is not saving your plan (storage is blocked or full), so it will be gone when you
      close the page. Print it or copy the checklist to keep it.
    </p>
  {/if}
  {#if showPlan && store.current !== null}
    {#if PlanView !== null && store.plan !== null && store.profile !== null}
      <!-- Keyed by plan, so chat, drafts and the active tab never carry over to another plan. -->
      {#key store.current.id}
        <PlanView
          {store}
          genai={props.genai}
          entry={store.current}
          plan={store.plan}
          profile={store.profile}
          focusHeading={navigated}
          print={() => {
            print();
          }}
          onedit={() => {
            editing = true;
            navigated = true;
          }}
          onnew={() => {
            store.clear();
            navigated = true;
          }}
        />
      {/key}
    {:else if planViewFailed || store.error !== null}
      <div class="notice notice-bad" role="alert">
        <p>Could not load your plan. Check your connection and try again.</p>
        <button type="button" class="button small" onclick={openSaved}>Try again</button>
        <button type="button" class="button small ghost" onclick={startOver}
          >Start a new plan</button
        >
      </div>
    {:else}
      <p class="muted" role="status">Loading your plan…</p>
    {/if}
  {:else}
    <Intake
      {store}
      {editing}
      focusHeading={navigated}
      ondone={done}
      oncancel={() => {
        editing = false;
      }}
    />
  {/if}
</main>

<footer class="site-footer">
  <p>
    Costs are planning estimates for India, not quotes. Check prices with vendors and permit rules
    with your local authorities.
  </p>
  <p>Your plan stays in this browser. Nothing you type is stored on a server.</p>
</footer>

<script lang="ts">
  import { onMount } from 'svelte';
  import { indiaDay } from '@jashn/core';
  import IconSprite from './components/IconSprite.svelte';
  import Logo from './components/Logo.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import Intake from './views/Intake.svelte';
  import type PlanViewComponent from './views/PlanView.svelte';
  import type { GenAi } from './lib/genai.ts';
  import { PlanStore } from './lib/plans.svelte.ts';
  import { clearFragment, readFragment } from './lib/share.ts';
  import { browserStorage } from './lib/storage.ts';

  /** The shell: skip link, header, the current view and the footer notes. */
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
  let notice = $state('');

  const showPlan = $derived(store.current !== null && store.plan !== null && !editing);

  $effect(() => {
    if (showPlan) loadPlanView();
  });

  async function readShared(): Promise<void> {
    const shared = readFragment(location.hash, store.today);
    if (shared.kind === 'none') return;
    clearFragment(location, history);
    if (shared.kind === 'invalid') {
      notice = 'That share link could not be opened: it is damaged or its event date has passed.';
      return;
    }
    notice = '';
    editing = false;
    navigated = true;
    await store.create(shared.input);
  }

  onMount(() => {
    void readShared();
    const onHash = (): void => void readShared();
    const onHide = (): void => {
      store.flush();
    };
    addEventListener('hashchange', onHash);
    addEventListener('pagehide', onHide);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('pagehide', onHide);
    };
  });

  function done(): void {
    editing = false;
    navigated = true;
  }
</script>

<IconSprite />
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="brand">
    <Logo />
    <span class="brand-name">Jashn</span>
    <span class="brand-tag">Celebration planner</span>
  </div>
  <ThemeToggle {storage} root={document.documentElement} />
</header>

<main id="main" tabindex="-1">
  {#if notice !== ''}
    <p class="notice notice-bad" role="alert">{notice}</p>
  {/if}
  {#if !store.persisted}
    <p class="notice" role="status">
      This browser is not saving plans (storage is blocked or full), so they will be gone when you
      close the page. Copy a share link to keep one.
    </p>
  {/if}
  {#if showPlan && store.current !== null && store.plan !== null && store.profile !== null}
    {#if PlanView !== null}
      <!-- Keyed by plan, so chat, drafts and the active tab never carry over to another plan. -->
      {#key store.current.id}
        <PlanView
          {store}
          genai={props.genai}
          entry={store.current}
          plan={store.plan}
          profile={store.profile}
          focusHeading={navigated}
          page={location}
          print={() => {
            print();
          }}
          onedit={() => {
            editing = true;
            navigated = true;
          }}
        />
      {/key}
    {:else if planViewFailed}
      <p class="notice notice-bad" role="alert">
        Could not load the plan view. Check your connection and reload the page.
      </p>
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
  <p>Your plans stay in this browser. Nothing you type is stored on a server.</p>
</footer>

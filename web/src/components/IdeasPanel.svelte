<script lang="ts">
  import type { EventInput, IdeaItem, Plan } from '@jashn/core';
  import type { GenAi } from '../lib/genai.ts';
  import type { SavedIdeas } from '../lib/storage.ts';
  import Icon from './Icon.svelte';
  import SourceBadge from './SourceBadge.svelte';

  /** Personalised ideas: generate, regenerate, and see where they came from. */
  interface Props {
    plan: Plan;
    saved: SavedIdeas | null;
    genai: GenAi;
    /** Receives the ideas and the input they were made for, so stale results can be dropped. */
    onideas: (ideas: SavedIdeas, forInput: EventInput) => void;
  }
  let { plan, saved, genai, onideas }: Props = $props();

  let busy = $state(false);
  /** Said once new ideas arrive; empty for ideas that were already saved. */
  let announced = $state('');

  /** The list sections in reading order; the theme and invitation have their own markup. */
  const groups: readonly { id: string; title: string; items: readonly IdeaItem[] }[] = $derived(
    saved === null
      ? []
      : [
          { id: 'decor', title: 'Decor', items: saved.ideas.decor },
          { id: 'menu', title: 'Menu', items: saved.ideas.menu },
          { id: 'activities', title: 'Activities', items: saved.ideas.activities },
          { id: 'touch', title: 'A special touch', items: [saved.ideas.touch] },
        ],
  );

  async function generate(): Promise<void> {
    // The button stays focusable while busy (aria-disabled), so a second press lands here.
    if (busy) return;
    busy = true;
    const { input } = plan;
    const { source, ...ideas } = await genai.ideas(plan);
    busy = false;
    announced = 'Ideas ready below.';
    onideas({ ideas, source }, input);
  }
</script>

<div class="ideas-controls">
  <button
    type="button"
    class="button primary"
    aria-busy={busy}
    aria-disabled={busy}
    onclick={() => void generate()}
  >
    <Icon name="spark" />
    {saved === null ? 'Generate ideas' : 'Regenerate ideas'}
  </button>
</div>

<!-- Only this short line is live; the ideas are read when the user moves into them. -->
<p class="muted" role="status">{busy ? 'Thinking up ideas…' : announced}</p>

<div aria-busy={busy}>
  {#if saved === null}
    {#if !busy}
      <p class="muted">
        Ideas for a theme, decor, menu, activities and the invitation, shaped by your needs.
      </p>
    {/if}
  {:else}
    {@const ideas = saved.ideas}
    <SourceBadge source={saved.source} />
    <div class="ideas">
      <section class="idea-theme" aria-labelledby="idea-theme-title">
        <h3 id="idea-theme-title">Theme: {ideas.theme.name}</h3>
        <p>{ideas.theme.why}</p>
        <ul class="palette" aria-label="Palette">
          {#each ideas.theme.palette as colour, index (index)}
            <li>{colour}</li>
          {/each}
        </ul>
      </section>
      {#each groups as group (group.id)}
        <section aria-labelledby="idea-{group.id}">
          <h3 id="idea-{group.id}">{group.title}</h3>
          <ul class="idea-list">
            {#each group.items as item, index (index)}
              <li><strong>{item.title}</strong>: {item.detail}</li>
            {/each}
          </ul>
        </section>
      {/each}
      <section aria-labelledby="idea-invitation">
        <h3 id="idea-invitation">Invitation wording</h3>
        <blockquote class="invitation">{ideas.invitation}</blockquote>
      </section>
    </div>
  {/if}
</div>

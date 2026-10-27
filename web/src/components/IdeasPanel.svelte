<script lang="ts">
  import { LANGUAGES, type EventInput, type IdeaItem, type Language, type Plan } from '@jashn/core';
  import type { GenAi } from '../lib/genai.ts';
  import { LANGUAGE_LABELS, textLang } from '../lib/labels.ts';
  import type { SavedIdeas } from '../lib/storage.ts';
  import { isLanguage } from '../lib/validate.ts';
  import Icon from './Icon.svelte';
  import SourceBadge from './SourceBadge.svelte';

  /** Personalised ideas: generate, regenerate, pick the language, and see where they came from. */
  interface Props {
    plan: Plan;
    saved: SavedIdeas | null;
    genai: GenAi;
    /** Receives the ideas and the input they were made for, so stale results can be dropped. */
    onideas: (ideas: SavedIdeas, forInput: EventInput) => void;
    onlanguage: (language: Language) => void;
  }
  let { plan, saved, genai, onideas, onlanguage }: Props = $props();

  let busy = $state(false);

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
    busy = true;
    const { input } = plan;
    const { source, ...ideas } = await genai.ideas(plan);
    busy = false;
    onideas({ ideas, source, language: input.language }, input);
  }
</script>

<div class="ideas-controls">
  <div class="field field-inline">
    <label for="ideas-language">Language</label>
    <select
      id="ideas-language"
      value={plan.input.language}
      onchange={(event) => {
        const next = event.currentTarget.value;
        if (isLanguage(next)) onlanguage(next);
      }}
    >
      {#each LANGUAGES as language (language)}
        <option value={language} lang={language}>{LANGUAGE_LABELS[language]}</option>
      {/each}
    </select>
  </div>
  <button
    type="button"
    class="button primary"
    aria-busy={busy}
    disabled={busy}
    onclick={() => void generate()}
  >
    <Icon name="spark" />
    {saved === null ? 'Generate ideas' : 'Regenerate ideas'}
  </button>
</div>

<div aria-live="polite" aria-busy={busy}>
  {#if busy}
    <p class="muted">Thinking up ideas…</p>
  {:else if saved === null}
    <p class="muted">
      Ideas for a theme, decor, menu, activities and the invitation, shaped by your needs.
    </p>
  {:else}
    {@const ideas = saved.ideas}
    {@const lang = textLang(saved.source, saved.language)}
    <SourceBadge source={saved.source} />
    <div class="ideas">
      <section class="idea-theme" aria-labelledby="idea-theme-title">
        <h3 id="idea-theme-title">Theme: <span {lang}>{ideas.theme.name}</span></h3>
        <p {lang}>{ideas.theme.why}</p>
        <ul class="palette" aria-label="Palette" {lang}>
          {#each ideas.theme.palette as colour, index (index)}
            <li>{colour}</li>
          {/each}
        </ul>
      </section>
      {#each groups as group (group.id)}
        <section aria-labelledby="idea-{group.id}">
          <h3 id="idea-{group.id}">{group.title}</h3>
          <ul class="idea-list" {lang}>
            {#each group.items as item, index (index)}
              <li><strong>{item.title}</strong>: {item.detail}</li>
            {/each}
          </ul>
        </section>
      {/each}
      <section aria-labelledby="idea-invitation">
        <h3 id="idea-invitation">Invitation wording</h3>
        <blockquote class="invitation" {lang}>{ideas.invitation}</blockquote>
      </section>
    </div>
  {/if}
</div>

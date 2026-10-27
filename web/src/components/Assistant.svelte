<script lang="ts">
  import { tick } from 'svelte';
  import {
    SUGGESTED_PROMPTS,
    buildPlan,
    diffPlans,
    validatePatch,
    type AssistTurn,
    type Language,
    type Plan,
    type PlanPatch,
    type Profile,
    type Source,
  } from '@jashn/core';
  import { MESSAGE_MAX, type GenAi } from '../lib/genai.ts';
  import { textLang } from '../lib/labels.ts';
  import { diffRows, patchRows, type PreviewRow } from '../lib/preview.ts';
  import Icon from './Icon.svelte';
  import SourceBadge from './SourceBadge.svelte';

  /**
   * Ask about the plan or request a change. A proposed change is shown as a before/after
   * preview and reaches the plan only when the user presses Apply.
   */
  interface Props {
    plan: Plan;
    profile: Profile;
    genai: GenAi;
    labelOf: (id: string) => string;
    onapply: (patch: PlanPatch) => void;
  }
  let { plan, profile, genai, labelOf, onapply }: Props = $props();

  interface Entry extends AssistTurn {
    readonly id: number;
    readonly source?: Source;
    /** The language generated text was asked for when this reply was made. */
    readonly language?: Language;
  }
  interface Proposal {
    /** The plan the preview was computed against; a proposal for an older plan is not shown. */
    readonly base: Plan;
    readonly patch: PlanPatch;
    readonly rows: readonly PreviewRow[];
  }

  let log = $state.raw<readonly Entry[]>([]);
  let message = $state('');
  let busy = $state(false);
  let proposal = $state.raw<Proposal | null>(null);
  let nextId = 0;
  let input = $state<HTMLInputElement>();
  let proposalTitle = $state<HTMLElement>();

  const current = $derived(proposal?.base === plan ? proposal : null);

  function say(entry: Omit<Entry, 'id'>): void {
    log = [...log, { ...entry, id: nextId++ }];
  }

  /** Re-validates the patch against the plan it will change and previews the consequences. */
  function propose(patch: PlanPatch): Proposal | null {
    const result = validatePatch(patch, plan.input, plan.today);
    if (!result.ok) return null;
    const after = buildPlan(result.value, plan.today, profile);
    const rows = [
      ...patchRows(plan.input, result.patch, labelOf),
      ...diffRows(diffPlans(plan, after), labelOf),
    ];
    return { base: plan, patch: result.patch, rows };
  }

  async function send(text: string): Promise<void> {
    const clean = text.trim().slice(0, MESSAGE_MAX);
    if (clean === '' || busy) return;
    const history = log.map(({ role, text: turn }) => ({ role, text: turn }));
    say({ role: 'user', text: clean });
    message = '';
    proposal = null;
    busy = true;
    const { language } = plan.input;
    const answer = await genai.assist(plan, clean, history);
    busy = false;
    say({ role: 'assistant', text: answer.reply, source: answer.source, language });
    if (answer.patch !== undefined) proposal = propose(answer.patch);
    // A preview needs a decision, so focus moves to it and it is announced by its heading.
    if (proposal !== null) {
      await tick();
      proposalTitle?.focus();
    }
  }

  /** Apply and Dismiss remove themselves, so focus returns to the message field. */
  async function settle(): Promise<void> {
    proposal = null;
    await tick();
    input?.focus();
  }

  function apply(chosen: Proposal): void {
    onapply(chosen.patch);
    say({ role: 'assistant', text: 'Done. The plan now includes that change.' });
    void settle();
  }
</script>

<section class="assistant card" aria-labelledby="assistant-title">
  <h2 id="assistant-title">Assistant</h2>
  <p class="muted">
    Ask about the plan or ask for a change; you see a preview before anything changes.
  </p>

  <ol class="chat-log" aria-live="polite" aria-busy={busy}>
    {#each log as entry (entry.id)}
      <li class="chat-{entry.role}">
        <span class="chat-who">{entry.role === 'user' ? 'You' : 'Jashn'}</span>
        <!-- User text inherits the page language; a reply keeps the language it was made in. -->
        <p
          lang={entry.role === 'user'
            ? undefined
            : entry.source === undefined
              ? 'en'
              : textLang(entry.source, entry.language ?? 'en')}
        >
          {entry.text}
        </p>
        {#if entry.source !== undefined}<SourceBadge source={entry.source} />{/if}
      </li>
    {/each}
    {#if busy}
      <li class="chat-assistant">
        <span class="chat-who">Jashn</span>
        <p>Thinking…</p>
      </li>
    {/if}
  </ol>

  {#if current !== null}
    <div class="proposal" role="group" aria-labelledby="proposal-title">
      <h3 id="proposal-title" tabindex="-1" bind:this={proposalTitle}>Proposed change</h3>
      <table>
        <caption class="visually-hidden">Before and after the proposed change</caption>
        <thead>
          <tr><th scope="col">Item</th><th scope="col">Now</th><th scope="col">After</th></tr>
        </thead>
        <tbody>
          {#each current.rows as row, index (index)}
            <tr><th scope="row">{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>
          {/each}
        </tbody>
      </table>
      <div class="button-row">
        <button
          type="button"
          class="button primary"
          onclick={() => {
            apply(current);
          }}>Apply change</button
        >
        <button type="button" class="button ghost" onclick={() => void settle()}>Dismiss</button>
      </div>
    </div>
  {/if}

  <ul class="chip-list" aria-label="Suggested questions">
    {#each SUGGESTED_PROMPTS as prompt (prompt)}
      <li>
        <button type="button" class="chip" aria-disabled={busy} onclick={() => void send(prompt)}>
          {prompt}
        </button>
      </li>
    {/each}
  </ul>

  <form
    class="chat-form"
    onsubmit={(event) => {
      event.preventDefault();
      void send(message);
    }}
  >
    <label for="assistant-message">Your message</label>
    <div class="chat-input">
      <input
        id="assistant-message"
        type="text"
        maxlength={MESSAGE_MAX}
        autocomplete="off"
        bind:value={message}
        bind:this={input}
        aria-describedby="assistant-hint"
      />
      <!-- aria-disabled keeps focus on the button while busy; send() ignores a press then. -->
      <button type="submit" class="button primary" aria-disabled={busy}>
        <Icon name="send" /> Send
      </button>
    </div>
    <p class="hint" id="assistant-hint">
      For example "cut guests by 20" or "what is late?". {message.length}/{MESSAGE_MAX}
    </p>
  </form>
</section>

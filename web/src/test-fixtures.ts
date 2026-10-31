/**
 * Shared test helpers: a fixed day, sample plans built with the full profile set, an
 * in-memory Storage and a scripted generative client. Imported by tests only.
 */
import {
  buildPlan,
  fromCivil,
  getProfile,
  ideasOffline,
  sampleEvent,
  type AssistReply,
  type EventInput,
  type Plan,
  type Profile,
  type SampleId,
} from '@jashn/core';
import type { GenAi } from './lib/genai.ts';
import { PlanStore } from './lib/plans.svelte.ts';
import type { SavedPlan } from './lib/storage.ts';

/** A fixed "today" (Monday 2 November 2026) so dates in assertions never drift. */
export const TODAY = fromCivil(2026, 11, 2);

/** A sample's input dated relative to TODAY. */
export function sampleInput(id: SampleId = 'lucknow-wedding'): EventInput {
  return sampleEvent(id, TODAY);
}

function profileFor(input: EventInput): Profile {
  return getProfile(input.type);
}

/** The plan for a sample (or any input) on TODAY. */
export function planFor(input: EventInput = sampleInput()): Plan {
  return buildPlan(input, TODAY, profileFor(input));
}

/** A saved entry around an input. */
export function savedPlan(overrides: Partial<SavedPlan> = {}): SavedPlan {
  return {
    id: 'plan-1',
    input: sampleInput(),
    checks: [],
    vendors: {},
    ideas: null,
    ...overrides,
  };
}

/** A minimal in-memory Storage; `failWrites` simulates a full or blocked store. */
export class MemoryStorage implements Storage {
  readonly #data = new Map<string, string>();
  failWrites = false;

  get length(): number {
    return this.#data.size;
  }
  clear(): void {
    this.#data.clear();
  }
  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#data.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.#data.set(key, value);
  }
}

/** A store on an in-memory Storage with sequential ids. */
export function makeStore(storage: Storage | null = new MemoryStorage()): PlanStore {
  let id = 0;
  return new PlanStore({
    storage,
    today: TODAY,
    newId: () => `plan-${String((id += 1))}`,
    writeDelayMs: 0,
  });
}

/** A generative client that answers from scripts, recording every call. */
export function fakeGenAi(
  reply: (message: string, plan: Plan) => AssistReply = () => ({ reply: 'Noted.' }),
): GenAi & { calls: string[] } {
  const calls: string[] = [];
  return {
    mode: 'demo',
    calls,
    ideas(plan) {
      calls.push('ideas');
      return Promise.resolve({ ...ideasOffline(plan.input), source: 'gemini' });
    },
    assist(plan, message) {
      calls.push(`assist:${message}`);
      return Promise.resolve({ ...reply(message, plan), source: 'fallback' });
    },
    draft(_plan, vendor) {
      calls.push(`draft:${vendor.id}`);
      return Promise.resolve({
        vendorId: vendor.id,
        text: `Hello ${vendor.label}`,
        source: 'gemini',
      });
    },
  };
}

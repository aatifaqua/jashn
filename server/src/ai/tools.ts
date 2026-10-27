/**
 * The assistant's single tool, update_event, whose parameters mirror the core's PlanPatch.
 * Its arguments are untrusted model output: the route passes them to validatePatch, the same
 * validation the form uses, and the user still confirms the change before it applies.
 */
import type { FunctionDeclaration, Tool } from '@google/genai';
import {
  CATEGORY_IDS,
  CITY_TIERS,
  CONSTRAINTS,
  INPUT_LIMITS,
  SETTINGS,
  STYLE_IDS,
  WEDDING_FUNCTIONS,
  type PatchField,
} from '@jashn/core';
import { z } from 'zod';
import { toResponseSchema } from './schemas.ts';

/** The tool's name, checked on every function call Gemini returns. */
export const UPDATE_EVENT = 'update_event';

const unique = (lists: readonly (readonly string[])[]): string[] => [...new Set(lists.flat())];

/**
 * One schema per patchable field. `satisfies` makes the compiler reject a missing or extra
 * field, so the declaration cannot drift from PlanPatch.
 */
const PATCH_SHAPE = {
  date: z.string().describe('New event date as YYYY-MM-DD.'),
  startTime: z.string().describe('New start time as 24-hour HH:MM.'),
  invited: z
    .int()
    .min(INPUT_LIMITS.invited.min)
    .max(INPUT_LIMITS.invited.max)
    .describe('New number of invited guests.'),
  budget: z
    .int()
    .min(INPUT_LIMITS.budget.min)
    .max(INPUT_LIMITS.budget.max)
    .describe('New total budget in whole rupees.'),
  priorities: z
    .array(z.enum(unique(Object.values(CATEGORY_IDS))))
    .max(INPUT_LIMITS.maxPriorities)
    .describe('The complete new list of budget priorities, replacing the current one.'),
  constraints: z
    .array(z.enum(CONSTRAINTS))
    .describe('The complete new list of needs, replacing the current one.'),
  setting: z.enum(SETTINGS).describe('New setting.'),
  tier: z.enum(CITY_TIERS).describe('New city size.'),
  functions: z
    .array(z.enum(WEDDING_FUNCTIONS))
    .describe('Weddings only: the complete new list of functions; ceremony is always included.'),
  style: z
    .enum(unique(Object.values(STYLE_IDS)))
    .describe("New style from the event type's styles."),
} satisfies Record<PatchField, z.ZodType>;

/** Every field optional: a call names only what the user asked to change. */
export const patchSchema = z.object(PATCH_SHAPE).partial().strict();

/** The function declaration Gemini sees. */
export const UPDATE_EVENT_DECLARATION: FunctionDeclaration = {
  name: UPDATE_EVENT,
  description:
    'Propose a change to the event when the user asks for one. Include only the fields the ' +
    'user asked to change. The user previews the change and decides whether to apply it.',
  parametersJsonSchema: toResponseSchema(patchSchema),
};

/** The tool list for assistant requests. */
export const ASSIST_TOOLS: readonly Tool[] = Object.freeze([
  { functionDeclarations: [UPDATE_EVENT_DECLARATION] },
]);

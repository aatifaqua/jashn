/**
 * Zod schemas for request bodies (strict: unknown keys are rejected) and for Gemini's
 * structured output. The response schemas are converted to JSON Schema for the API, so the
 * shape Gemini is asked for and the shape the server accepts are one definition.
 */
import {
  ASSIST_LIMITS,
  CITY_TIERS,
  CONSTRAINTS,
  EVENT_TYPES,
  GUARD_LIMITS,
  SETTINGS,
  VENDOR_IDS,
  type Draft,
  type Ideas,
} from '@jashn/core';
import { z } from 'zod';

/**
 * Structural bounds only, deliberately looser than the core's rules: the core validator runs
 * next and gives the precise, user-facing message for each field.
 */
const text = (max: number) => z.string().max(max);

/** EventInput as JSON; semantic checks (dates, ranges, profile ids) are the core's job. */
export const eventInputSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    style: text(40),
    functions: z.array(text(40)).max(10),
    date: text(20),
    startTime: text(20),
    city: text(200),
    tier: z.enum(CITY_TIERS),
    setting: z.enum(SETTINGS),
    venueBooked: z.boolean(),
    invited: z.number(),
    budget: z.number(),
    priorities: z.array(text(40)).max(10),
    constraints: z.array(z.enum(CONSTRAINTS)).max(CONSTRAINTS.length),
    note: text(1000),
  })
  .strict();

/** POST /api/ideas */
export const ideasRequestSchema = z.object({ input: eventInputSchema }).strict();

/** One earlier turn of the conversation. */
const turnSchema = z
  .object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(ASSIST_LIMITS.turn) })
  .strict();

/** POST /api/assist */
export const assistRequestSchema = z
  .object({
    input: eventInputSchema,
    message: z.string().trim().min(1).max(ASSIST_LIMITS.message),
    history: z.array(turnSchema).max(ASSIST_LIMITS.history).default([]),
  })
  .strict();

/** POST /api/draft */
export const draftRequestSchema = z
  .object({ input: eventInputSchema, vendorId: z.enum(VENDOR_IDS) })
  .strict();

const item = z
  .object({
    title: z.string().min(1).max(GUARD_LIMITS.title),
    detail: z.string().min(1).max(GUARD_LIMITS.detail),
  })
  .strict();

/** Generated ideas, mirroring the core's Ideas type. */
export const ideasSchema = z
  .object({
    theme: z
      .object({
        name: z.string().min(1).max(GUARD_LIMITS.themeName),
        palette: z.array(z.string().min(1).max(GUARD_LIMITS.paletteWord)).min(2).max(5),
        why: z.string().min(1).max(GUARD_LIMITS.why),
      })
      .strict(),
    decor: z.array(item).length(3),
    menu: z.array(item).min(3).max(5),
    activities: z.array(item).length(3),
    touch: item,
    invitation: z.string().min(1).max(GUARD_LIMITS.invitation),
  })
  .strict() satisfies z.ZodType<Ideas>;

/** A generated vendor enquiry; the server adds the vendor id. */
export const draftTextSchema = z
  .object({ text: z.string().min(1).max(GUARD_LIMITS.draft) })
  .strict() satisfies z.ZodType<Omit<Draft, 'vendorId'>>;

/** JSON Schema for the API; the `$schema` marker is dropped because Gemini does not need it. */
export function toResponseSchema(schema: z.ZodType): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(z.toJSONSchema(schema)).filter(([key]) => key !== '$schema'),
  );
}

/** Response schemas, converted once at start-up. */
export const IDEAS_RESPONSE_SCHEMA = toResponseSchema(ideasSchema);
/** See IDEAS_RESPONSE_SCHEMA. */
export const DRAFT_RESPONSE_SCHEMA = toResponseSchema(draftTextSchema);

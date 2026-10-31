/**
 * Strict zod schemas for request bodies and for Gemini's output. The output schemas also become
 * the JSON Schema Gemini is given, so the requested and accepted shapes are one definition.
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

// Structural bounds only, looser than the core's rules: the core validator runs next and
// gives the user-facing message for each field.
const text = (max: number) => z.string().max(max);

const eventInputSchema = z
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

/** Body of POST /api/ideas. */
export const ideasRequestSchema = z.object({ input: eventInputSchema }).strict();

const turnSchema = z
  .object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(ASSIST_LIMITS.turn) })
  .strict();

/** Body of POST /api/assist. */
export const assistRequestSchema = z
  .object({
    input: eventInputSchema,
    message: z.string().trim().min(1).max(ASSIST_LIMITS.message),
    history: z.array(turnSchema).max(ASSIST_LIMITS.history).default([]),
  })
  .strict();

/** Body of POST /api/draft. */
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

/** JSON Schema without the `$schema` marker, which Gemini does not need. */
export function toResponseSchema(schema: z.ZodType): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(z.toJSONSchema(schema)).filter(([key]) => key !== '$schema'),
  );
}

/** Converted once at start-up, not per request. */
export const IDEAS_RESPONSE_SCHEMA = toResponseSchema(ideasSchema);
/** Converted once at start-up, not per request. */
export const DRAFT_RESPONSE_SCHEMA = toResponseSchema(draftTextSchema);

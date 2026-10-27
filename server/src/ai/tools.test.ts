import { PATCH_FIELDS } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { DRAFT_RESPONSE_SCHEMA, IDEAS_RESPONSE_SCHEMA } from './schemas.ts';
import { ASSIST_TOOLS, patchSchema, UPDATE_EVENT, UPDATE_EVENT_DECLARATION } from './tools.ts';

describe('update_event declaration', () => {
  it('mirrors exactly the patchable fields, all optional', () => {
    const params = UPDATE_EVENT_DECLARATION.parametersJsonSchema as {
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(Object.keys(params.properties).sort()).toEqual([...PATCH_FIELDS].sort());
    expect(params.required).toBeUndefined();
    expect(UPDATE_EVENT_DECLARATION.name).toBe(UPDATE_EVENT);
    expect(ASSIST_TOOLS[0]?.functionDeclarations).toEqual([UPDATE_EVENT_DECLARATION]);
  });

  it('offers every style and category id once', () => {
    const shape = patchSchema.shape;
    expect(shape.style.unwrap().options).toContain('clean-up');
    const categories = shape.priorities.unwrap().element.options;
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe('response schemas', () => {
  it('are plain JSON Schema objects without the $schema marker', () => {
    for (const schema of [IDEAS_RESPONSE_SCHEMA, DRAFT_RESPONSE_SCHEMA]) {
      expect(schema.type).toBe('object');
      expect(schema).not.toHaveProperty('$schema');
    }
  });
});

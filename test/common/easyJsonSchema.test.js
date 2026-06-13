import { describe, it, expect } from 'vitest';
import easyJsonSchema from '../../common/easyJsonSchema.js';

describe('easyJsonSchema', () => {
  it('primitive field', () => {
    const schema = easyJsonSchema({ name: 'string', count: 'number' });
    expect(schema).toEqual({
      type: 'object',
      required: [],
      properties: {
        name: { type: 'string' },
        count: { type: 'number' }
      }
    });
  });

  it('required field with asterisk prefix', () => {
    const schema = easyJsonSchema({ '*id': 'number', token: 'string' });
    expect(schema.required).toEqual(['id']);
    expect(schema.properties.id).toEqual({ type: 'number' });
    expect(schema.properties.token).toEqual({ type: 'string' });
  });

  it('array template', () => {
    const schema = easyJsonSchema({
      req_query: [{ name: 'string', required: 'string' }]
    });
    expect(schema.properties.req_query.type).toBe('array');
    expect(schema.properties.req_query.items).toEqual({
      type: 'object',
      required: [],
      properties: {
        name: { type: 'string' },
        required: { type: 'string' }
      }
    });
  });

  it('json schema fragment', () => {
    const schema = easyJsonSchema({
      '*path': { type: 'string', minLength: 1 },
      mode: { type: 'string', default: 'html' }
    });
    expect(schema.required).toEqual(['path']);
    expect(schema.properties.path).toEqual({ type: 'string', minLength: 1 });
    expect(schema.properties.mode).toEqual({ type: 'string', default: 'html' });
  });

  it('validateParams integration shape', () => {
    const schema = easyJsonSchema({
      '*type': 'string',
      merge: { type: 'string', default: 'normal' }
    });
    expect(schema).toEqual({
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string' },
        merge: { type: 'string', default: 'normal' }
      }
    });
  });
});

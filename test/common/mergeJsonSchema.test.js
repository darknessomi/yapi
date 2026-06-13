import { describe, it, expect } from 'vitest';
import mergeJsonSchema from '../../common/mergeJsonSchema.js';

describe('mergeJsonSchema', () => {
  it('base', () => {
    let schema1 = {
      type: 'string',
      default: 'xxx'
    };

    let schema2 = {
      type: 'string',
      format: 'email'
    };

    let result = mergeJsonSchema(schema1, schema2);

    expect(result).toEqual({
      type: 'string',
      default: 'xxx',
      format: 'email'
    });
  });

  it('object', () => {
    let schema1 = {
      type: 'object',
      title: 'empty object',
      xxx: 1,
      properties: {
        field_1: {
          type: 'string',
          format: 'email'
        }
      }
    };

    let schema2 = {
      type: 'object',
      title: 'empty object',
      properties: {
        field_1: {
          type: 'string',
          description: 'dd'
        }
      }
    };

    let result = mergeJsonSchema(schema1, schema2);

    expect(result).toEqual({
      type: 'object',
      title: 'empty object',
      xxx: 1,
      properties: {
        field_1: {
          type: 'string',
          format: 'email',
          description: 'dd'
        }
      }
    });
  });

  it('array', () => {
    let schema1 = {
      type: 'object',
      title: 'empty object',
      properties: {
        field_1: {
          type: 'array',
          tt: 1,
          items: {
            type: 'object',
            xxx: '2',
            properties: {
              field_3: {
                format: 'ttt',
                type: 'string'
              }
            }
          }
        }
      }
    };

    let schema2 = {
      type: 'object',
      title: 'empty object',
      properties: {
        field_1: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field_3: {
                type: 'string',
                enum: [1, 2]
              }
            }
          }
        }
      }
    };

    let result = mergeJsonSchema(schema1, schema2);

    expect(result).toEqual({
      type: 'object',
      title: 'empty object',
      properties: {
        field_1: {
          type: 'array',
          tt: 1,
          items: {
            type: 'object',
            xxx: '2',
            properties: {
              field_3: {
                format: 'ttt',
                type: 'string',
                enum: [1, 2]
              }
            }
          }
        }
      }
    });
  });
});

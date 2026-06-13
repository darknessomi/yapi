import { describe, it, expect } from 'vitest';
import { handleParamsValue, schemaValidator } from '../../common/utils.js';

describe('common utils', () => {
  it('handleParamsValue', () => {
    const json = JSON.stringify({
      t: 1,
      obj: {
        name: 'dd',
        value: 'vvvv'
      }
    });

    expect(handleParamsValue(' aaaa | length')).toBe('aaaa | length');
    expect(handleParamsValue('{{aaaa |upper }}')).toBe('AAAA');
    expect(handleParamsValue(json)).toBe(json);
    expect(handleParamsValue('   {{ dkkdjf }}')).toBe('dkkdjf');
    expect(handleParamsValue('   {{ dkkdjf | upper | kkk }}')).toBe('{{ dkkdjf | upper | kkk }}');
    expect(handleParamsValue('aaa   {{ aaaa | upper }} bbbb')).toBe('aaa   AAAA bbbb');
    expect(handleParamsValue('aaa   {{ aaaa | upper }} bbbb,aaa   {{ aaaa | upper }} bbbb')).toBe(
      'aaa   AAAA bbbb,aaa   AAAA bbbb'
    );
    expect(handleParamsValue('{{aaaa | length}}')).toBe(4);
    expect(handleParamsValue('{{4444 | number}}')).toBe(4444);
  });

  it('schemaValidator', () => {
    const schema1 = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        errcode: {
          type: 'number'
        },
        errmsg: {
          type: 'string'
        },
        data: {
          type: 'object',
          properties: {}
        }
      },
      required: ['errcode', 'errmsg']
    };

    const data1 = {
      errcode: 0,
      errmsg: '成功！',
      data: {}
    };

    expect(schemaValidator(schema1, data1).valid).toBe(true);

    const schema2 = {
      type: 'object',
      required: ['id', 'category', 'status'],
      properties: {
        id: {
          type: 'integer',
          format: 'int64',
          minimum: 1,
          maximum: 4,
          enum: [2, 3, 4],
          exclusiveMinimum: true,
          exclusiveMaximum: true,
          description: '所有功能'
        },
        category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              minimum: 1,
              maximum: 3,
              exclusiveMinimum: true,
              description: 'exclusiveMinimum'
            },
            type: {
              type: 'string',
              pattern: '\\d',
              default: '12',
              minLength: 1,
              maxLength: 2,
              description: '正则， 长度限制'
            },
            name: {
              type: 'string',
              enum: ['小明', '小风'],
              description: '枚举'
            },
            formate: {
              type: 'string',
              format: 'ctitle',
              description: 'formate'
            },
            boolean: {
              type: 'boolean'
            },
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: {
                    type: 'boolean'
                  }
                },
                required: ['item']
              },
              description: 'uniqueItems',
              uniqueItems: true
            },
            array2: {
              type: 'array',
              items: {
                type: 'integer',
                enum: [2],
                minimum: 1,
                maximum: 2,
                description: '枚举和最大值最小值'
              },
              minItems: 1,
              maxItems: 2,
              description: '最大个数和最小个数'
            }
          },
          xml: {
            name: 'Category'
          },
          $$ref: '#/definitions/Category',
          required: ['id', 'name', 'boolean']
        },
        status: {
          type: 'number',
          description: '枚举',
          enum: [23.9, 34.9]
        }
      },
      xml: {
        name: 'Pet'
      },
      $$ref: '#/definitions/Pet'
    };

    const data2 = {
      id: 2,
      category: {
        id: 2,
        type: '8',
        name: '小明',
        formate: '任治导具',
        boolean: false,
        array: [
          {
            item: true
          },
          {
            item: false
          }
        ],
        array2: [2, 2]
      },
      status: 23.9
    };

    expect(schemaValidator(schema2, data2).valid).toBe(true);
  });
});

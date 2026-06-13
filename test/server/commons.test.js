import { describe, it, expect } from 'vitest';
import {
  ltrim,
  rtrim,
  trim,
  handleParams,
  verifyPath,
  sandbox,
  handleVarPath
} from '../../server/utils/commons.js';

describe('commons', () => {
  it('trim', () => {
    expect(trim(' a   b  ksjdfk    ')).toBe('a   b  ksjdfk');
    expect(trim(1)).toBe('1');
  });

  it('ltrim', () => {
    expect(ltrim(' a   b  ksjdfk    ')).toBe('a   b  ksjdfk    ');
    expect(ltrim(1)).toBe('1');
  });

  it('rtrim', () => {
    expect(rtrim(' a   b  ksjdfk    ')).toBe(' a   b  ksjdfk');
    expect(rtrim(1)).toBe('1');
  });

  it('handleParams', () => {
    expect(
      handleParams(
        {
          a: '  s k ',
          b: ' a123456 '
        },
        {
          a: 'string',
          b: 'number'
        }
      )
    ).toEqual({
      a: 's k',
      b: 0
    });
  });

  it('verifyPath', () => {
    expect(verifyPath('a/b')).toBe(false);
    expect(verifyPath('/a:b/t/.api/k_-/tt')).toBe(true);
    expect(verifyPath('/a:b/t/.api/k_-/tt/')).toBe(true);
  });

  it('sandbox', () => {
    expect(
      sandbox(
        {
          a: 1
        },
        'a=2'
      )
    ).toEqual({ a: 2 });
  });

  it('async sandbox executes script in worker', async () => {
    const sandboxFn = require('../../server/utils/sandbox.js');
    const result = await sandboxFn({ a: 1 }, 'a=2');
    expect(result).toEqual({ a: 2 });
  });

  it('async sandbox restores assert and log callbacks', async () => {
    const sandboxFn = require('../../server/utils/sandbox.js');
    const logs = [];
    const context = {
      status: 200,
      assert: require('assert'),
      log: msg => logs.push(String(msg))
    };
    const result = await sandboxFn(context, 'assert.equal(status, 200); log("ok")');
    expect(result.status).toBe(200);
    expect(logs).toEqual(['ok']);
  });

  it('handleVarPath', () => {
    let result = [];
    let pathname = '/a/:id';
    handleVarPath(pathname, result);

    expect(result).toEqual([
      {
        name: 'id',
        desc: ''
      }
    ]);
  });

  it('handleVarPath2', () => {
    let result = [];
    let pathname = '/a/{id}';
    handleVarPath(pathname, result);

    expect(result).toEqual([
      {
        name: 'id',
        desc: ''
      }
    ]);
  });

  it('handleVarPath4', () => {
    let result = [];
    let pathname = '/a/id={id}/tt/:sub/kk';
    handleVarPath(pathname, result);

    expect(result).toEqual([
      {
        name: 'sub',
        desc: ''
      },
      {
        name: 'id',
        desc: ''
      }
    ]);
  });
});

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const lib = require('../common/lib.js');
const { initPlugins } = require('../common/plugin.js');

describe('lib', () => {
  it('initPlugins', () => {
    let configs = initPlugins(['a', 'b'], 'exts', () => ({
      server: true,
      client: true
    }));
    expect(configs).toEqual([
      {
        name: 'a',
        enable: true,
        server: true,
        client: true
      },
      {
        name: 'b',
        enable: true,
        server: true,
        client: true
      }
    ]);
  });

  it('initPlugins2', () => {
    let configs = initPlugins(['a', 'b'], 'exts', () => ({
      server: true,
      client: false
    }));
    expect(configs).toEqual([
      {
        name: 'a',
        enable: true,
        server: true,
        client: false
      },
      {
        name: 'b',
        enable: true,
        server: true,
        client: false
      }
    ]);
  });

  it('initPlugins3', () => {
    let configs = initPlugins(['a', { name: 'a' }], 'exts', () => ({
      server: false,
      client: true
    }));
    expect(configs).toEqual([
      {
        name: 'a',
        enable: true,
        server: false,
        client: true
      }
    ]);
  });

  it('initPlugins4', () => {
    let configs = initPlugins(
      [
        {
          name: 'a',
          options: {
            a: 1,
            t: {
              c: 3
            }
          }
        }
      ],
      'exts',
      () => ({
        server: false,
        client: true
      })
    );
    expect(configs).toEqual([
      {
        name: 'a',
        enable: true,
        server: false,
        client: true,
        options: {
          a: 1,
          t: {
            c: 3
          }
        }
      }
    ]);
  });

  it('initPlugins5', () => {
    let configs = initPlugins(['a', 'b'], 'exts', () => ({
      server: false,
      client: false
    }));
    expect(configs).toEqual([]);
  });

  it('testJsonEqual', () => {
    let json1 = {
      a: '1',
      b: 2,
      c: {
        t: 3,
        x: [11, 22]
      }
    };

    let json2 = {
      c: {
        x: [11, 22],
        t: 3
      },
      b: 2,
      a: '1'
    };
    expect(lib.jsonEqual(json1, json1)).toBe(true);
  });

  it('testJsonEqualBase', () => {
    expect(lib.jsonEqual(1, 1)).toBe(true);
  });

  it('testJsonEqualBaseString', () => {
    expect(lib.jsonEqual('2', '2')).toBe(true);
  });

  it('isDeepMatch shallow', () => {
    expect(lib.isDeepMatch({ a: 'aaaaa', b: 2 }, { a: 'aaaaa' })).toBe(true);
  });

  it('isDeepMatch nested', () => {
    expect(lib.isDeepMatch({ a: 1, b: 2, c: { t: 'ttt' } }, { c: { t: 'ttt' } })).toBe(true);
  });

  it('isDeepMatch empty object', () => {
    expect(lib.isDeepMatch({}, undefined)).toBe(true);
  });

  it('isDeepMatch undefined target', () => {
    expect(lib.isDeepMatch(undefined, {})).toBe(true);
  });

  it('isDeepMatch undefined source', () => {
    expect(lib.isDeepMatch(undefined, { a: 1 })).toBe(false);
  });

  it('isDeepMatch partial fields', () => {
    expect(
      lib.isDeepMatch(
        {
          t: 1,
          b: '2',
          ip: '127.0.0.1',
          interface_id: 1857,
          ip_enable: true,
          params: { a: 'x', b: 'y' },
          res_body: '111',
          code: 1
        },
        { t: '1' }
      )
    ).toBe(true);
  });

  it('isDeepMatch array', () => {
    expect(lib.isDeepMatch({ t: [{ a: 1 }] }, { t: [{ a: 1 }] })).toBe(true);
  });

  it('isDeepMatch array mismatch', () => {
    expect(lib.isDeepMatch({ t: [{ a: 1, b: 12 }] }, { t: [{ a: 1 }] })).toBe(false);
  });

  it('isDeepMatch array root', () => {
    expect(lib.isDeepMatch([{ a: 1 }], [{ a: 1 }])).toBe(true);
  });
});

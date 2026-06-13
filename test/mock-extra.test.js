import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const mockExtra = require('../common/mock-extra.js');

describe('mock-extra', () => {
  it('mock-extra', () => {
    let data = '@string ${body.a}';
    expect(mockExtra(data)).toBe('@string ${body.a}');
    let data2 = {
      a: '@string',
      b: {
        t: '${body.a}'
      }
    };
    expect(
      mockExtra(data2, {
        body: {
          a: 3
        }
      })
    ).toEqual({
      a: '@string',
      b: {
        t: 3
      }
    });

    let data3 = {
      a: '@string',
      b: {
        t: '${body}'
      }
    };
    expect(
      mockExtra(data3, {
        body: {
          a: 3,
          t: 5
        }
      })
    ).toEqual({
      a: '@string',
      b: {
        t: {
          a: 3,
          t: 5
        }
      }
    });

    let data4 = {
      a: '@string',
      b: {
        t: '${query.arr}'
      }
    };

    expect(
      mockExtra(data4, {
        query: {
          arr: [1, 2, 3]
        }
      })
    ).toEqual({
      a: '@string',
      b: {
        t: [1, 2, 3]
      }
    });

    let data5 = {
      a: '@string',
      b: {
        t: '${ttt.arr}'
      }
    };

    expect(
      mockExtra(data5, {
        ttt: {
          arr: [1, 2, 3]
        }
      })
    ).toEqual({
      a: '@string',
      b: {
        t: [1, 2, 3]
      }
    });

    let data6 = {
      a: '@string',
      b: {
        'ttt|regexp': 'a|b'
      }
    };

    expect(
      mockExtra(data6, {
        ttt: {
          arr: [1, 2, 3]
        }
      })
    ).toEqual({
      a: '@string',
      b: {
        ttt: /a|b/
      }
    });
  });
});

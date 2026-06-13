import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const rewire = require('rewire');
const mockServer = rewire('../../server/middleware/mockServer.js');
const matchApi = mockServer.__get__('matchApi');

describe('mockServer', () => {
  it('matchApi', () => {
    const apiRule = '/user/:username';
    expect(matchApi('/user/tom', apiRule)).toBeTruthy();
    expect(matchApi('/user/111$$%#$##$#2222222222!!!!!!!', apiRule)).toBeTruthy();
    expect(matchApi('/user/a/', apiRule)).toBe(false);
    expect(matchApi('/use/a', apiRule)).toBe(false);

    const apiRule_2 = '/user/:username/kk';
    expect(matchApi('/user/aa/kk', apiRule_2)).toBeTruthy();
    expect(matchApi('/user/!!!###kksdjfks***/kk', apiRule_2)).toBeTruthy();
    expect(matchApi('/user/aa/aa', apiRule_2)).toBe(false);

    const apiRule_3 = '/user/:sdfsdfj/ttt/:sdkfjkj';
    expect(matchApi('/user/a/ttt/b', apiRule_3)).toBeTruthy();
    expect(matchApi('/user/a/ttt2/b', apiRule_3)).toBe(false);

    const apiRule_4 = '/user/{aaa}/ttt/{bbbb}';
    expect(matchApi('/user/a/ttt/b', apiRule_4)).toBeTruthy();
    expect(matchApi('/user/a/ttt2/b', apiRule_4)).toBe(false);

    const apiRule_5 = '/user/{aaa}/ttt/{bbbb}';
    let r5 = matchApi('/user/ac/ttt/bd', apiRule_5);
    expect(r5).toEqual({
      aaa: 'ac',
      bbbb: 'bd',
      __weight: 2
    });

    const apiRule_6 = '/user/a1={aaa}/ttt/b1={bbbb}';
    let r6 = matchApi('/user/a1=aaa/ttt/b1=111q', apiRule_6);
    expect(r6).toEqual({
      aaa: 'aaa',
      bbbb: '111q',
      __weight: 2
    });

    const apiRule_7 = '/user/a1={aaa}/ttt/b1={bbbb}/xxx/yyy';
    let r7 = matchApi('/user/a1=aaa/ttt/b1=111q/xxx/yyy', apiRule_7);
    expect(r7).toEqual({
      aaa: 'aaa',
      bbbb: '111q',
      __weight: 4
    });
  });
});

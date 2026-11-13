import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const yapi = require('../../server/yapi.js');
const { getToken, parseToken } = require('../../server/utils/token.js');

describe('project token cipher', () => {
  const originalSalt = yapi.WEBCONFIG.passsalt;

  afterEach(() => {
    yapi.WEBCONFIG.passsalt = originalSalt;
  });

  it('matches ciphertext from the removed crypto.createCipher(aes192)', () => {
    yapi.WEBCONFIG.passsalt = 'abcde';
    // openssl enc -aes-192-cbc -md md5 -pass pass:abcde -nosalt
    expect(getToken('token-value', '1')).toBe('a5207b7a2130f1f53c356b91569f6534');
  });

  it('round-trips a token', () => {
    yapi.WEBCONFIG.passsalt = 'abcde';
    const encoded = getToken('project-token', '42');
    expect(parseToken(encoded)).toEqual({
      uid: '42',
      projectToken: 'project-token'
    });
  });

  it('returns false for a token that cannot be decrypted', () => {
    yapi.WEBCONFIG.passsalt = 'abcde';
    expect(parseToken('00')).toBe(false);
  });
});

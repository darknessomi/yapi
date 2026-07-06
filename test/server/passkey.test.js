import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import {
  getPasskeyConfig,
  bufferToBase64URL,
  base64URLToBuffer,
  createOtpCode,
  hashOtpCode,
  verifyOtpCode,
  stripPort,
  isLocalhost
} from '../../server/utils/passkey.js';

const require = createRequire(import.meta.url);
const yapi = require('../../server/yapi.js');
const passkeyChallengeModel = require('../../server/models/passkeyChallenge.js');

describe('passkey utils', () => {
  const originalPasskeyConfig = yapi.WEBCONFIG.passkey;

  afterEach(() => {
    yapi.WEBCONFIG.passkey = originalPasskeyConfig;
  });

  it('strips host port and detects localhost', () => {
    expect(stripPort('example.com:3000')).toBe('example.com');
    expect(isLocalhost('localhost')).toBe(true);
    expect(isLocalhost('127.0.0.1')).toBe(true);
    expect(isLocalhost('example.com')).toBe(false);
  });

  it('derives rpID and origin from request context', () => {
    yapi.WEBCONFIG.passkey = undefined;

    expect(
      getPasskeyConfig({
        host: 'localhost:3000',
        origin: 'http://localhost:3000'
      })
    ).toEqual({
      rpID: 'localhost',
      rpName: 'YApi',
      origin: 'http://localhost:3000'
    });
  });

  it('derives origin from protocol and host when ctx.origin is missing', () => {
    yapi.WEBCONFIG.passkey = undefined;

    expect(
      getPasskeyConfig({
        host: '127.0.0.1:3000',
        protocol: 'http'
      })
    ).toEqual({
      rpID: '127.0.0.1',
      rpName: 'YApi',
      origin: 'http://127.0.0.1:3000'
    });
  });

  it('rejects non-HTTPS non-localhost origins', () => {
    yapi.WEBCONFIG.passkey = undefined;

    expect(() =>
      getPasskeyConfig({
        host: 'example.com',
        origin: 'http://example.com'
      })
    ).toThrow('通行密钥只支持 HTTPS');
  });

  it('uses explicit passkey config when present', () => {
    yapi.WEBCONFIG.passkey = {
      rpName: 'Internal YApi',
      rpID: 'api.example.com',
      origin: 'https://api.example.com'
    };

    expect(
      getPasskeyConfig({
        host: 'localhost:3000',
        origin: 'http://localhost:3000'
      })
    ).toEqual({
      rpID: 'api.example.com',
      rpName: 'Internal YApi',
      origin: 'https://api.example.com'
    });
  });

  it('round-trips base64url buffers', () => {
    const input = Buffer.from('passkey-public-key');
    const encoded = bufferToBase64URL(input);

    expect(encoded).not.toContain('=');
    expect(base64URLToBuffer(encoded).toString()).toBe('passkey-public-key');
  });

  it('creates and verifies email otp codes', () => {
    const code = createOtpCode();
    const hash = hashOtpCode('user@example.com', code);

    expect(code).toMatch(/^\d{6}$/);
    expect(verifyOtpCode('user@example.com', code, hash)).toBe(true);
    expect(verifyOtpCode('user@example.com', '000000', hash)).toBe(false);
  });
});

describe('passkey challenge model', () => {
  let originalCommons;
  let now;

  beforeEach(() => {
    originalCommons = yapi.commons;
    now = 1000;
    yapi.commons = {
      time: () => now
    };
  });

  afterEach(() => {
    yapi.commons = originalCommons;
  });

  function createModel(recordRef) {
    const inst = Object.create(passkeyChallengeModel.prototype);
    inst.model = {
      updateOne(query, data) {
        recordRef.value = { ...recordRef.value, ...query, ...data };
        return { exec: () => Promise.resolve({ ok: 1 }) };
      },
      findOne(query) {
        const record = recordRef.value;
        const matched =
          record &&
          Object.keys(query).every(key => {
            return record[key] === query[key];
          });
        return { exec: () => Promise.resolve(matched ? record : null) };
      },
      deleteOne(query) {
        if (
          recordRef.value &&
          Object.keys(query).every(key => {
            return recordRef.value[key] === query[key];
          })
        ) {
          recordRef.value = null;
        }
        return { exec: () => Promise.resolve({ deletedCount: 1 }) };
      }
    };
    return inst;
  }

  it('upserts auth challenge by email and type', async () => {
    const recordRef = { value: null };
    const inst = createModel(recordRef);

    await inst.upsert({
      email: 'user@example.com',
      type: 'auth',
      challenge: 'challenge-a'
    });

    expect(recordRef.value.email).toBe('user@example.com');
    expect(recordRef.value.challenge).toBe('challenge-a');
    expect(recordRef.value.expires_at).toBe(
      now + passkeyChallengeModel.CHALLENGE_EXPIRES_SECONDS
    );

    await inst.upsert({
      email: 'user@example.com',
      type: 'auth',
      challenge: 'challenge-b'
    });

    expect(recordRef.value.challenge).toBe('challenge-b');
  });

  it('returns null and deletes expired challenge', async () => {
    const recordRef = {
      value: {
        _id: 1,
        uid: 11,
        type: 'register',
        challenge: 'old',
        expires_at: 999
      }
    };
    const inst = createModel(recordRef);

    expect(await inst.getValid({ uid: 11, type: 'register' })).toBe(null);
    expect(recordRef.value).toBe(null);
  });
});

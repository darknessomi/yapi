const yapi = require('../yapi.js');
const crypto = require('crypto');

function stripPort(host) {
  return String(host || '').split(':')[0];
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getPasskeyConfig(ctx) {
  const config = yapi.WEBCONFIG.passkey || {};
  const requestHost = stripPort(ctx.host || ctx.hostname);
  const rpID = config.rpID || requestHost;
  const rpName = config.rpName || 'YApi';
  const requestOrigin =
    ctx.origin || (ctx.protocol && ctx.host ? `${ctx.protocol}://${ctx.host}` : '');
  const origin = config.origin || requestOrigin;

  if (!rpID) {
    throw new Error('通行密钥配置错误：无法确定 rpID');
  }

  if (!origin) {
    throw new Error('通行密钥配置错误：无法确定 origin');
  }

  const originURL = new URL(origin);
  if (originURL.protocol !== 'https:' && !isLocalhost(originURL.hostname)) {
    throw new Error('通行密钥只支持 HTTPS；本地开发仅允许 localhost 或 127.0.0.1');
  }

  return {
    rpID,
    rpName,
    origin
  };
}

function bufferToBase64URL(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64URLToBuffer(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return Buffer.from(base64 + (pad ? '='.repeat(4 - pad) : ''), 'base64');
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtpCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${String(email || '').trim()}:${String(code || '').trim()}`)
    .digest('hex');
}

function verifyOtpCode(email, code, hash) {
  return hashOtpCode(email, code) === hash;
}

module.exports = {
  getPasskeyConfig,
  bufferToBase64URL,
  base64URLToBuffer,
  createOtpCode,
  hashOtpCode,
  verifyOtpCode,
  stripPort,
  isLocalhost
};

const yapi = require('../yapi')

const crypto = require('crypto');
const forge = require('node-forge');

// node-forge 把字符串当字节串。旧 createCipher 按 utf8 取密码字节。
function legacyAes192(password, decipher) {
  const passwordBytes = Buffer.from(password).toString('binary');
  const derived = forge.pbe.opensslDeriveBytes(passwordBytes, null, 40);
  const key = Buffer.from(derived.slice(0, 24), 'binary');
  const iv = Buffer.from(derived.slice(24), 'binary');
  const create = decipher ? crypto.createDecipheriv : crypto.createCipheriv;
  return create('aes192', key, iv);
}

function aseEncode(data, password) {
  const cipher = legacyAes192(password, false);
  let crypted = cipher.update(data, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

function aseDecode(data, password) {
  const decipher = legacyAes192(password, true);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const defaultSalt = 'abcde';

exports.getToken = function getToken(token, uid){
  if(!token)throw new Error('token 不能为空')
  yapi.WEBCONFIG.passsalt = yapi.WEBCONFIG.passsalt || defaultSalt;
  return aseEncode(uid + '|' + token, yapi.WEBCONFIG.passsalt)
}

exports.parseToken = function parseToken(token){
  if(!token)throw new Error('token 不能为空')
  yapi.WEBCONFIG.passsalt = yapi.WEBCONFIG.passsalt || defaultSalt;
  let tokens;
  try{
    tokens = aseDecode(token, yapi.WEBCONFIG.passsalt)
  }catch(e){}  
  if(tokens && typeof tokens === 'string' && tokens.indexOf('|') > 0){
    tokens = tokens.split('|')
    return {
      uid: tokens[0],
      projectToken: tokens[1]
    }
  }
  return false;
  
}

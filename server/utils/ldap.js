const { Client } = require('ldapts');
const yapi = require('../yapi.js');

function rejectMsg(message) {
  return Promise.reject({ type: false, message });
}

exports.ldapQuery = async (username, password) => {
  const { ldapLogin } = yapi.WEBCONFIG;
  const client = new Client({ url: ldapLogin.server });

  try {
    if (ldapLogin.bindPassword) {
      try {
        await client.bind(ldapLogin.baseDn, ldapLogin.bindPassword);
      } catch (err) {
        return rejectMsg(`LDAP server绑定失败: ${err}`);
      }
    }

    const searchDn = ldapLogin.searchDn;
    const searchStandard = ldapLogin.searchStandard;
    let customFilter;
    if (/^(&|\|)/gi.test(searchStandard)) {
      customFilter = searchStandard.replace(/%s/g, username);
    } else {
      customFilter = `${searchStandard}=${username}`;
    }

    const { searchEntries, searchReferences } = await client.search(searchDn, {
      filter: `(${customFilter})`,
      scope: 'sub'
    });

    if (searchReferences && searchReferences.length > 0) {
      console.log(
        'referral: ' +
          searchReferences
            .map(referral => (Array.isArray(referral) ? referral.join() : String(referral)))
            .join()
      );
    }

    if (!searchEntries.length) {
      return rejectMsg('用户名不存在');
    }

    const user = searchEntries[0];
    try {
      await client.bind(user.dn, password);
    } catch (err) {
      return rejectMsg(`用户名或密码不正确: ${err}`);
    }

    return {
      type: true,
      message: '验证成功',
      info: user
    };
  } catch (err) {
    if (err && err.type === false) {
      return rejectMsg(err.message);
    }
    return rejectMsg(String(err.message || err));
  } finally {
    await client.unbind().catch(() => {});
  }
};

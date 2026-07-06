const userModel = require('../models/user.js');
const passkeyModel = require('../models/passkey.js');
const passkeyChallengeModel = require('../models/passkeyChallenge.js');
const yapi = require('../yapi.js');
const baseController = require('./base.js');
const common = require('../utils/commons.js');
const ldap = require('../utils/ldap.js');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const {
  getPasskeyConfig,
  bufferToBase64URL,
  base64URLToBuffer,
  createOtpCode,
  hashOtpCode,
  verifyOtpCode
} = require('../utils/passkey.js');

const interfaceModel = require('../models/interface.js');
const groupModel = require('../models/group.js');
const projectModel = require('../models/project.js');
const avatarModel = require('../models/avatar.js');

const jwt = require('jsonwebtoken');

class userController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.Model = yapi.getInst(userModel);
  }

  passkeyRes(user) {
    return {
      username: user.username,
      role: user.role,
      uid: user._id,
      email: user.email,
      add_time: user.add_time,
      up_time: user.up_time,
      type: user.type || 'site',
      study: user.study
    };
  }

  normalizeEmail(email) {
    return (email || '').trim();
  }

  async sendPasswordLoginCode(email) {
    if (!yapi.mail) {
      return false;
    }

    const code = createOtpCode();
    const challengeInst = yapi.getInst(passkeyChallengeModel);
    await challengeInst.upsert({
      email,
      type: 'password_login',
      challenge: hashOtpCode(email, code)
    });

    yapi.commons.sendMail({
      to: email,
      subject: '密码登录验证码',
      contents: `<h3>YApi 密码登录验证码</h3><p>你的验证码是：<b>${code}</b></p><p>验证码 5 分钟内有效。如果不是你本人操作，请忽略此邮件。</p>`
    });
    return true;
  }

  async appendPasskeyBound(users) {
    const list = Array.isArray(users) ? users : [];
    const passkeyInst = yapi.getInst(passkeyModel);
    const counts = await passkeyInst.countByUids(list.map(user => user._id || user.uid));
    const boundMap = counts.reduce((map, item) => {
      map[Number(item._id)] = item.count > 0;
      return map;
    }, {});

    return list.map(user => {
      const obj = user.toObject ? user.toObject() : { ...user };
      const uid = obj._id || obj.uid;
      obj.passkey_bound = !!boundMap[Number(uid)];
      return obj;
    });
  }
  /**
   * 用户登录接口
   * @interface /user/login
   * @method POST
   * @category user
   * @foldnumber 10
   * @param {String} email email名称，不能为空
   * @param  {String} password 密码，不能为空
   * @returns {Object}
   * @example ./api/user/login.json
   */
  async login(ctx) {
    //登录
    let userInst = yapi.getInst(userModel); //创建user实体
    let email = ctx.request.body.email;
    email = (email || '').trim();
    let password = ctx.request.body.password;
    let otpCode = ctx.request.body.otp_code;

    if (!email) {
      return (ctx.body = yapi.commons.resReturn(null, 400, 'email不能为空'));
    }
    if (!password) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '密码不能为空'));
    }

    let result = await userInst.findByEmail(email);

    if (!result) {
      return (ctx.body = yapi.commons.resReturn(null, 404, '该用户不存在'));
    } else if (yapi.commons.generatePassword(password, result.passsalt) === result.password) {
      const passkeyInst = yapi.getInst(passkeyModel);
      const userPasskeys = await passkeyInst.findByUid(result._id);
      if (userPasskeys.length > 0 && yapi.mail) {
        if (!otpCode) {
          const sendOtp = ctx.request.body.send_otp === true;
          if (sendOtp) {
            await this.sendPasswordLoginCode(email);
            return (ctx.body = yapi.commons.resReturn(
              { require_email_otp: true, otp_sent: true },
              406,
              '验证码已发送，请查收邮件'
            ));
          }
          return (ctx.body = yapi.commons.resReturn(
            { require_email_otp: true, otp_sent: false },
            406,
            '该账号已绑定通行密钥，请使用通行密钥登录或获取邮件验证码'
          ));
        }

        const challengeInst = yapi.getInst(passkeyChallengeModel);
        const challenge = await challengeInst.getValid({
          email,
          type: 'password_login'
        });
        if (!challenge || !verifyOtpCode(email, otpCode, challenge.challenge)) {
          return (ctx.body = yapi.commons.resReturn(null, 407, '邮件验证码错误或已过期'));
        }

        await challengeInst.del({
          email,
          type: 'password_login'
        });
      }

      this.setLoginCookie(result._id, result.passsalt);

      return (ctx.body = yapi.commons.resReturn(
        {
          username: result.username,
          role: result.role,
          uid: result._id,
          email: result.email,
          add_time: result.add_time,
          up_time: result.up_time,
          type: 'site',
          study: result.study
        },
        0,
        'logout success...'
      ));
    } else {
      return (ctx.body = yapi.commons.resReturn(null, 405, '密码错误'));
    }
  }

  /**
   * 退出登录接口
   * @interface /user/logout
   * @method GET
   * @category user
   * @foldnumber 10
   * @returns {Object}
   * @example ./api/user/logout.json
   */

  async logout(ctx) {
    ctx.cookies.set('_yapi_token', null);
    ctx.cookies.set('_yapi_uid', null);
    ctx.body = yapi.commons.resReturn('ok');
  }

  /**
   * 更新
   * @interface /user/up_study
   * @method GET
   * @category user
   * @foldnumber 10
   * @returns {Object}
   * @example
   */

  async upStudy(ctx) {
    let userInst = yapi.getInst(userModel); //创建user实体
    let data = {
      up_time: yapi.commons.time(),
      study: true
    };
    try {
      let result = await userInst.update(this.getUid(), data);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 401, e.message);
    }
  }

  async loginByToken(ctx) {
    try {
      let ret = await yapi.emitHook('third_login', ctx);
      let login = await this.handleThirdLogin(ret.email, ret.username);
      if (login === true) {
        yapi.commons.log('login success');
        ctx.redirect('/group');
      }
    } catch (e) {
      yapi.commons.log(e.message, 'error');
      ctx.redirect('/');
    }
  }

  /**
   * ldap登录
   * @interface /user/login_by_ldap
   * @method
   * @category user
   * @foldnumber 10
   * @param {String} email email名称，不能为空
   * @param  {String} password 密码，不能为空
   * @returns {Object}
   *
   */
  async getLdapAuth(ctx) {
    try {
      const { email, password } = ctx.request.body;
      // const username = email.split(/\@/g)[0];
      const { info: ldapInfo } = await ldap.ldapQuery(email, password);
      const emailPrefix = email.split(/@/g)[0];
      const emailPostfix = yapi.WEBCONFIG.ldapLogin.emailPostfix;

      const emailParams =
        ldapInfo[yapi.WEBCONFIG.ldapLogin.emailKey || 'mail'] ||
        (emailPostfix ? emailPrefix + emailPostfix : email);
      const username = ldapInfo[yapi.WEBCONFIG.ldapLogin.usernameKey] || emailPrefix;

      let login = await this.handleThirdLogin(emailParams, username);

      if (login === true) {
        let userInst = yapi.getInst(userModel); //创建user实体
        let result = await userInst.findByEmail(emailParams);
        return (ctx.body = yapi.commons.resReturn(
          {
            username: result.username,
            role: result.role,
            uid: result._id,
            email: result.email,
            add_time: result.add_time,
            up_time: result.up_time,
            type: result.type || 'third',
            study: result.study
          },
          0,
          'logout success...'
        ));
      }
    } catch (e) {
      yapi.commons.log(e.message, 'error');
      return (ctx.body = yapi.commons.resReturn(null, 401, e.message));
    }
  }

  /**
   * 获取当前用户已绑定通行密钥
   * @interface /user/passkey/list
   * @method GET
   * @category user
   */
  async passkeyList(ctx) {
    try {
      let passkeyInst = yapi.getInst(passkeyModel);
      let list = await passkeyInst.listByUid(this.getUid());
      ctx.body = yapi.commons.resReturn(
        list.map(item => ({
          id: item._id,
          name: item.name,
          transports: item.transports || [],
          deviceType: item.deviceType,
          backedUp: item.backedUp,
          add_time: item.add_time,
          last_used_time: item.last_used_time
        }))
      );
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 生成通行密钥绑定选项
   * @interface /user/passkey/register/options
   * @method POST
   * @category user
   */
  async passkeyRegisterOptions(ctx) {
    try {
      let user = this.$user;
      let passkeyInst = yapi.getInst(passkeyModel);
      let challengeInst = yapi.getInst(passkeyChallengeModel);
      let userPasskeys = await passkeyInst.findByUid(this.getUid());
      let { rpID, rpName } = getPasskeyConfig(ctx);

      let options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(String(user._id)),
        userName: user.email,
        userDisplayName: user.username,
        attestationType: 'none',
        excludeCredentials: userPasskeys.map(passkey => ({
          id: passkey.credentialID,
          transports: passkey.transports || []
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred'
        }
      });

      await challengeInst.upsert({
        uid: this.getUid(),
        type: 'register',
        challenge: options.challenge
      });

      ctx.body = yapi.commons.resReturn(options);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 校验并保存通行密钥绑定结果
   * @interface /user/passkey/register/verify
   * @method POST
   * @category user
   */
  async passkeyRegisterVerify(ctx) {
    try {
      let response = ctx.request.body.response || ctx.request.body;
      let name = ctx.request.body.name || '通行密钥';
      let challengeInst = yapi.getInst(passkeyChallengeModel);
      let challenge = await challengeInst.getValid({
        uid: this.getUid(),
        type: 'register'
      });

      if (!challenge) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥绑定请求已过期'));
      }

      let { rpID, origin } = getPasskeyConfig(ctx);
      let verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID
      });

      if (!verification.verified || !verification.registrationInfo) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥绑定失败'));
      }

      let { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      let passkeyInst = yapi.getInst(passkeyModel);
      let repeated = await passkeyInst.findByCredentialID(credential.id);
      if (repeated) {
        return (ctx.body = yapi.commons.resReturn(null, 409, '该通行密钥已绑定'));
      }

      let now = yapi.commons.time();
      let passkey = await passkeyInst.save({
        uid: this.getUid(),
        credentialID: credential.id,
        publicKey: bufferToBase64URL(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || response.response?.transports || [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name,
        add_time: now,
        last_used_time: 0
      });

      await challengeInst.del({
        uid: this.getUid(),
        type: 'register'
      });

      ctx.body = yapi.commons.resReturn({
        id: passkey._id,
        name: passkey.name,
        transports: passkey.transports || [],
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        add_time: passkey.add_time,
        last_used_time: passkey.last_used_time
      });
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 删除当前用户通行密钥
   * @interface /user/passkey/delete
   * @method POST
   * @category user
   */
  async passkeyDelete(ctx) {
    try {
      let id = ctx.request.body.id;
      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥 id 不能为空'));
      }

      let passkeyInst = yapi.getInst(passkeyModel);
      let result = await passkeyInst.deleteByUidAndId(this.getUid(), id);
      if (!result || result.deletedCount < 1) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '通行密钥不存在'));
      }

      ctx.body = yapi.commons.resReturn('ok');
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 按邮箱生成通行密钥登录选项
   * @interface /user/passkey/auth/options
   * @method POST
   * @category user
   */
  async passkeyAuthOptions(ctx) {
    try {
      let email = this.normalizeEmail(ctx.request.body.email);
      if (!email) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'email不能为空'));
      }

      let userInst = yapi.getInst(userModel);
      let user = await userInst.findByEmail(email);
      if (!user) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '该用户不存在'));
      }

      let passkeyInst = yapi.getInst(passkeyModel);
      let userPasskeys = await passkeyInst.findByUid(user._id);
      if (!userPasskeys.length) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '该用户未绑定通行密钥'));
      }

      let { rpID } = getPasskeyConfig(ctx);
      let options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userPasskeys.map(passkey => ({
          id: passkey.credentialID,
          transports: passkey.transports || []
        })),
        userVerification: 'preferred'
      });

      let challengeInst = yapi.getInst(passkeyChallengeModel);
      await challengeInst.upsert({
        email,
        type: 'auth',
        challenge: options.challenge
      });

      ctx.body = yapi.commons.resReturn(options);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 生成通行密钥自动填充（Conditional UI）登录选项
   * @interface /user/passkey/auth/options/conditional
   * @method POST
   * @category user
   */
  async passkeyAuthOptionsConditional(ctx) {
    try {
      let { rpID } = getPasskeyConfig(ctx);
      let options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred'
      });

      let challengeInst = yapi.getInst(passkeyChallengeModel);
      await challengeInst.upsert({
        type: 'auth_conditional',
        challenge: options.challenge
      });

      ctx.body = yapi.commons.resReturn(options);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 校验通行密钥登录结果
   * @interface /user/passkey/auth/verify
   * @method POST
   * @category user
   */
  async passkeyAuthVerify(ctx) {
    try {
      let email = this.normalizeEmail(ctx.request.body.email);
      let response = ctx.request.body.response || ctx.request.body;
      if (!response || !response.id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥响应无效'));
      }

      let passkeyInst = yapi.getInst(passkeyModel);
      let passkey = await passkeyInst.findByCredentialID(response.id);
      if (!passkey) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '通行密钥不存在'));
      }

      let userInst = yapi.getInst(userModel);
      let user = await userInst.findById(passkey.uid);
      if (!user) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '该用户不存在'));
      }

      if (email && this.normalizeEmail(user.email) !== email) {
        return (ctx.body = yapi.commons.resReturn(null, 404, '通行密钥不存在'));
      }
      email = user.email;

      let challengeInst = yapi.getInst(passkeyChallengeModel);
      let challengeType = ctx.request.body.email ? 'auth' : 'auth_conditional';
      let challengeQuery =
        challengeType === 'auth' ? { email, type: 'auth' } : { type: 'auth_conditional' };
      let challenge = await challengeInst.getValid(challengeQuery);
      if (!challenge) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥登录请求已过期'));
      }

      let { rpID, origin } = getPasskeyConfig(ctx);
      let verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: base64URLToBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports || []
        }
      });

      if (!verification.verified) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '通行密钥登录失败'));
      }

      await passkeyInst.updateCounter(
        passkey.credentialID,
        verification.authenticationInfo.newCounter
      );
      await challengeInst.del(challengeQuery);
      this.setLoginCookie(user._id, user.passsalt);

      ctx.body = yapi.commons.resReturn(this.passkeyRes(user));
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  // 处理第三方登录
  async handleThirdLogin(email, username) {
    let user, data, passsalt;
    let userInst = yapi.getInst(userModel);

    try {
      user = await userInst.findByEmail(email);

      // 新建用户信息
      if (!user || !user._id) {
        passsalt = yapi.commons.randStr();
        data = {
          username: username,
          password: yapi.commons.generatePassword(passsalt, passsalt),
          email: email,
          passsalt: passsalt,
          role: 'member',
          add_time: yapi.commons.time(),
          up_time: yapi.commons.time(),
          type: 'third'
        };
        user = await userInst.save(data);
        await this.handlePrivateGroup(user._id, username, email);
        yapi.commons.sendMail({
          to: email,
          contents: `<h3>亲爱的用户：</h3><p>您好，感谢使用YApi平台，你的邮箱账号是：${email}</p>`
        });
      }

      this.setLoginCookie(user._id, user.passsalt);
      return true;
    } catch (e) {
      console.error('third_login:', e.message); // eslint-disable-line
      throw new Error(`third_login: ${e.message}`);
    }
  }

  /**
   * 修改用户密码
   * @interface /user/change_password
   * @method POST
   * @category user
   * @param {Number} uid 用户ID
   * @param {Number} [old_password] 旧密码, 非admin用户必须传
   * @param {Number} password 新密码
   * @return {Object}
   * @example ./api/user/change_password.json
   */
  async changePassword(ctx) {
    let params = ctx.request.body;
    let userInst = yapi.getInst(userModel);

    if (!params.uid) {
      return (ctx.body = yapi.commons.resReturn(null, 400, 'uid不能为空'));
    }

    if (!params.password) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '密码不能为空'));
    }

    let user = await userInst.findById(params.uid);
    if (this.getRole() !== 'admin' && params.uid != this.getUid()) {
      return (ctx.body = yapi.commons.resReturn(null, 402, '没有权限'));
    }

    if (this.getRole() !== 'admin' || user.role === 'admin') {
      if (!params.old_password) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '旧密码不能为空'));
      }

      if (yapi.commons.generatePassword(params.old_password, user.passsalt) !== user.password) {
        return (ctx.body = yapi.commons.resReturn(null, 402, '旧密码错误'));
      }
    }

    let passsalt = yapi.commons.randStr();
    let data = {
      up_time: yapi.commons.time(),
      password: yapi.commons.generatePassword(params.password, passsalt),
      passsalt: passsalt
    };
    try {
      let result = await userInst.update(params.uid, data);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 401, e.message);
    }
  }

  async handlePrivateGroup(uid) {
    var groupInst = yapi.getInst(groupModel);
    await groupInst.save({
      uid: uid,
      group_name: 'User-' + uid,
      add_time: yapi.commons.time(),
      up_time: yapi.commons.time(),
      type: 'private'
    });
  }

  setLoginCookie(uid, passsalt) {
    let token = jwt.sign({ uid: uid }, passsalt, { expiresIn: '7 days' });

    this.ctx.cookies.set('_yapi_token', token, {
      expires: yapi.commons.expireDate(7),
      httpOnly: true
    });
    this.ctx.cookies.set('_yapi_uid', uid, {
      expires: yapi.commons.expireDate(7),
      httpOnly: true
    });
  }

  /**
   * 用户注册接口
   * @interface /user/reg
   * @method POST
   * @category user
   * @foldnumber 10
   * @param {String} email email名称，不能为空
   * @param  {String} password 密码，不能为空
   * @param {String} [username] 用户名
   * @returns {Object}
   * @example ./api/user/login.json
   */
  async reg(ctx) {
    //注册
    if (yapi.WEBCONFIG.closeRegister) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '禁止注册，请联系管理员'));
    }
    let userInst = yapi.getInst(userModel);
    let params = ctx.request.body; //获取请求的参数,检查是否存在用户名和密码

    params = yapi.commons.handleParams(params, {
      username: 'string',
      password: 'string',
      email: 'string'
    });

    if (!params.email) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '邮箱不能为空'));
    }

    if (!params.password) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '密码不能为空'));
    }

    let checkRepeat = await userInst.checkRepeat(params.email); //然后检查是否已经存在该用户

    if (checkRepeat > 0) {
      return (ctx.body = yapi.commons.resReturn(null, 401, '该email已经注册'));
    }

    let passsalt = yapi.commons.randStr();
    let data = {
      username: params.username,
      password: yapi.commons.generatePassword(params.password, passsalt), //加密
      email: params.email,
      passsalt: passsalt,
      role: 'member',
      add_time: yapi.commons.time(),
      up_time: yapi.commons.time(),
      type: 'site'
    };

    if (!data.username) {
      data.username = data.email.substr(0, data.email.indexOf('@'));
    }

    try {
      let user = await userInst.save(data);

      this.setLoginCookie(user._id, user.passsalt);
      await this.handlePrivateGroup(user._id, user.username, user.email);
      ctx.body = yapi.commons.resReturn({
        uid: user._id,
        email: user.email,
        username: user.username,
        add_time: user.add_time,
        up_time: user.up_time,
        role: 'member',
        type: user.type,
        study: false
      });
      yapi.commons.sendMail({
        to: user.email,
        contents: `<h3>亲爱的用户：</h3><p>您好，感谢使用YApi可视化接口平台,您的账号 ${
          params.email
        } 已经注册成功</p>`
      });
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 401, e.message);
    }
  }

  /**
   * 获取用户列表
   * @interface /user/list
   * @method GET
   * @category user
   * @foldnumber 10
   * @param {Number} [page] 分页页码
   * @param {Number} [limit] 分页大小,默认为10条
   * @returns {Object}
   * @example
   */
  async list(ctx) {
    let page = ctx.request.query.page || 1,
      limit = ctx.request.query.limit || 10;

    const userInst = yapi.getInst(userModel);
    try {
      let user = await userInst.listWithPaging(page, limit);
      user = await this.appendPasskeyBound(user);
      let count = await userInst.listCount();
      return (ctx.body = yapi.commons.resReturn({
        count: count,
        total: Math.ceil(count / limit),
        list: user
      }));
    } catch (e) {
      return (ctx.body = yapi.commons.resReturn(null, 402, e.message));
    }
  }

  /**
   * 获取用户个人信息
   * @interface /user/find
   * @method GET
   * @param id 用户uid
   * @category user
   * @foldnumber 10
   * @returns {Object}
   * @example
   */
  async findById(ctx) {
    //根据id获取用户信息
    try {
      let userInst = yapi.getInst(userModel);
      let id = ctx.request.query.id;

      if (this.getRole() !== 'admin' && id != this.getUid()) {
        return (ctx.body = yapi.commons.resReturn(null, 401, '没有权限'));
      }

      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'uid不能为空'));
      }

      let result = await userInst.findById(id);

      if (!result) {
        return (ctx.body = yapi.commons.resReturn(null, 402, '不存在的用户'));
      }

      return (ctx.body = yapi.commons.resReturn({
        uid: result._id,
        username: result.username,
        email: result.email,
        role: result.role,
        type: result.type,
        add_time: result.add_time,
        up_time: result.up_time
      }));
    } catch (e) {
      return (ctx.body = yapi.commons.resReturn(null, 402, e.message));
    }
  }

  /**
   * 删除用户,只有admin用户才有此权限
   * @interface /user/del
   * @method POST
   * @param id 用户uid
   * @category user
   * @foldnumber 10
   * @returns {Object}
   * @example
   */
  async del(ctx) {
    //根据id删除一个用户
    try {
      if (this.getRole() !== 'admin') {
        return (ctx.body = yapi.commons.resReturn(null, 402, 'Without permission.'));
      }

      let userInst = yapi.getInst(userModel);
      let id = ctx.request.body.id;
      if (id == this.getUid()) {
        return (ctx.body = yapi.commons.resReturn(null, 403, '禁止删除管理员'));
      }
      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'uid不能为空'));
      }

      let result = await userInst.del(id);

      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 更新用户个人信息
   * @interface /user/update
   * @method POST
   * @param uid  用户uid
   * @param [role] 用户角色,只有管理员有权限修改
   * @param [username] String
   * @param [email] String
   * @category user
   * @foldnumber 10
   * @returns {Object}
   * @example
   */
  async update(ctx) {
    //更新用户信息
    try {
      let params = ctx.request.body;

      params = yapi.commons.handleParams(params, {
        username: 'string',
        email: 'string'
      });

      if (this.getRole() !== 'admin' && params.uid != this.getUid()) {
        return (ctx.body = yapi.commons.resReturn(null, 401, '没有权限'));
      }

      let userInst = yapi.getInst(userModel);
      let id = params.uid;

      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'uid不能为空'));
      }

      let userData = await userInst.findById(id);
      if (!userData) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'uid不存在'));
      }

      let data = {
        up_time: yapi.commons.time()
      };

      params.username && (data.username = params.username);
      params.email && (data.email = params.email);

      if (data.email) {
        var checkRepeat = await userInst.checkRepeat(data.email); //然后检查是否已经存在该用户
        if (checkRepeat > 0) {
          return (ctx.body = yapi.commons.resReturn(null, 401, '该email已经注册'));
        }
      }

      let member = {
        uid: id,
        username: data.username || userData.username,
        email: data.email || userData.email
      };
      let groupInst = yapi.getInst(groupModel);
      await groupInst.updateMember(member);
      let projectInst = yapi.getInst(projectModel);
      await projectInst.updateMember(member);

      let result = await userInst.update(id, data);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * 上传用户头像
   * @interface /user/upload_avatar
   * @method POST
   * @param {*} basecode  base64编码，通过h5 api传给后端
   * @category user
   * @returns {Object}
   * @example
   */

  async uploadAvatar(ctx) {
    try {
      let basecode = ctx.request.body.basecode;
      if (!basecode) {
        return (ctx.body = yapi.commons.resReturn(null, 400, 'basecode不能为空'));
      }
      let pngPrefix = 'data:image/png;base64,';
      let jpegPrefix = 'data:image/jpeg;base64,';
      let type;
      if (basecode.substr(0, pngPrefix.length) === pngPrefix) {
        basecode = basecode.substr(pngPrefix.length);
        type = 'image/png';
      } else if (basecode.substr(0, jpegPrefix.length) === jpegPrefix) {
        basecode = basecode.substr(jpegPrefix.length);
        type = 'image/jpeg';
      } else {
        return (ctx.body = yapi.commons.resReturn(null, 400, '仅支持jpeg和png格式的图片'));
      }
      let strLength = basecode.length;
      if (parseInt(strLength - (strLength / 8) * 2) > 200000) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '图片大小不能超过200kb'));
      }

      let avatarInst = yapi.getInst(avatarModel);
      let result = await avatarInst.up(this.getUid(), basecode, type);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 401, e.message);
    }
  }

  /**
   * 根据用户uid头像
   * @interface /user/avatar
   * @method GET
   * @param {*} uid
   * @category user
   * @returns {Object}
   * @example
   */

  async avatar(ctx) {
    try {
      let uid = ctx.query.uid ? ctx.query.uid : this.getUid();
      let avatarInst = yapi.getInst(avatarModel);
      let data = await avatarInst.get(uid);
      let dataBuffer, type;
      if (!data || !data.basecode) {
        dataBuffer = yapi.fs.readFileSync(yapi.path.join(yapi.WEBROOT, 'static/image/avatar.png'));
        type = 'image/png';
      } else {
        type = data.type;
        dataBuffer = new Buffer(data.basecode, 'base64');
      }

      ctx.set('Content-type', type);
      ctx.body = dataBuffer;
    } catch (err) {
      ctx.body = 'error:' + err.message;
    }
  }

  /**
   * 模糊搜索用户名或者email
   * @interface /user/search
   * @method GET
   * @category user
   * @foldnumber 10
   * @param {String} q
   * @return {Object}
   * @example ./api/user/search.json
   */
  async search(ctx) {
    const { q } = ctx.request.query;

    if (!q) {
      return (ctx.body = yapi.commons.resReturn(void 0, 400, 'No keyword.'));
    }

    if (!yapi.commons.validateSearchKeyword(q)) {
      return (ctx.body = yapi.commons.resReturn(void 0, 400, 'Bad query.'));
    }

    let queryList = await this.Model.search(q);
    queryList = await this.appendPasskeyBound(queryList);
    let rules = [
      {
        key: '_id',
        alias: 'uid'
      },
      'username',
      'email',
      'role',
      {
        key: 'add_time',
        alias: 'addTime'
      },
      {
        key: 'up_time',
        alias: 'upTime'
      },
      'passkey_bound'
    ];

    let filteredRes = common.filterRes(queryList, rules);

    return (ctx.body = yapi.commons.resReturn(filteredRes, 0, 'ok'));
  }

  /**
   * 根据路由id初始化项目数据
   * @interface /user/project
   * @method GET
   * @category user
   * @foldnumber 10
   * @param {String} type 可选group|interface|project
   * @param {Number} id
   * @return {Object}
   * @example
   */
  async project(ctx) {
    let { id, type } = ctx.request.query;
    let result = {};
    try {
      if (type === 'interface') {
        let interfaceInst = yapi.getInst(interfaceModel);
        let interfaceData = await interfaceInst.get(id);
        result.interface = interfaceData;
        type = 'project';
        id = interfaceData.project_id;
      }

      if (type === 'project') {
        let projectInst = yapi.getInst(projectModel);
        let projectData = await projectInst.get(id);
        result.project = projectData.toObject();
        let ownerAuth = await this.checkAuth(id, 'project', 'danger'),
          devAuth;
        if (ownerAuth) {
          result.project.role = 'owner';
        } else {
          devAuth = await this.checkAuth(id, 'project', 'site');
          if (devAuth) {
            result.project.role = 'dev';
          } else {
            result.project.role = 'member';
          }
        }
        type = 'group';
        id = projectData.group_id;
      }

      if (type === 'group') {
        let groupInst = yapi.getInst(groupModel);
        let groupData = await groupInst.get(id);
        result.group = groupData.toObject();
        let ownerAuth = await this.checkAuth(id, 'group', 'danger'),
          devAuth;
        if (ownerAuth) {
          result.group.role = 'owner';
        } else {
          devAuth = await this.checkAuth(id, 'group', 'site');
          if (devAuth) {
            result.group.role = 'dev';
          } else {
            result.group.role = 'member';
          }
        }
      }

      return (ctx.body = yapi.commons.resReturn(result));
    } catch (e) {
      return (ctx.body = yapi.commons.resReturn(result, 422, e.message));
    }
  }
}

module.exports = userController;

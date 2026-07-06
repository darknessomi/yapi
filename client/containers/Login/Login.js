import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Form, Button, Input, Icon, message, Radio } from 'antd';
import axios from 'axios';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { loginActions, loginLdapActions, loginPasskeyActions } from '../../reducer/modules/user';
import { withRouter } from 'react-router';
const FormItem = Form.Item;
const RadioGroup = Radio.Group;

import './Login.scss';

const formItemStyle = {
  marginBottom: '.16rem'
};

const changeHeight = {
  height: '.42rem'
};

const OTP_RESEND_COOLDOWN = 60;

function isPasskeyCancelled(error) {
  const name = error && error.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

@connect(
  state => {
    return {
      loginData: state.user,
      isLDAP: state.user.isLDAP
    };
  },
  {
    loginActions,
    loginLdapActions,
    loginPasskeyActions
  }
)
@withRouter
class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loginType: 'ldap',
      passkeySupported: false,
      passkeyLoading: false,
      otpRequired: false,
      otpSent: false,
      otpCountdown: 0,
      passkeySkipped: false
    };
    this.otpCountdownTimer = null;
  }

  static propTypes = {
    form: PropTypes.object,
    history: PropTypes.object,
    loginActions: PropTypes.func,
    loginLdapActions: PropTypes.func,
    loginPasskeyActions: PropTypes.func,
    isLDAP: PropTypes.bool
  };

  componentDidMount() {
    console.log('isLDAP', this.props.isLDAP);
    if (browserSupportsWebAuthn()) {
      this.setState({ passkeySupported: true });
      this.startConditionalPasskey();
    }
  }

  componentWillUnmount() {
    this.clearOtpCountdown();
  }

  clearOtpCountdown = () => {
    if (this.otpCountdownTimer) {
      clearInterval(this.otpCountdownTimer);
      this.otpCountdownTimer = null;
    }
  };

  startOtpCountdown = () => {
    this.clearOtpCountdown();
    this.setState({ otpCountdown: OTP_RESEND_COOLDOWN });
    this.otpCountdownTimer = setInterval(() => {
      this.setState(prev => {
        if (prev.otpCountdown <= 1) {
          this.clearOtpCountdown();
          return { otpCountdown: 0 };
        }
        return { otpCountdown: prev.otpCountdown - 1 };
      });
    }, 1000);
  };

  startConditionalPasskey = async () => {
    try {
      const optionsRes = await axios.post('/api/user/passkey/auth/options/conditional');
      if (optionsRes.data.errcode !== 0) {
        return;
      }

      const authResponse = await startAuthentication({
        optionsJSON: optionsRes.data.data,
        useBrowserAutofill: true
      });
      await this.verifyPasskeyResponse(authResponse);
    } catch (e) {
      if (!isPasskeyCancelled(e)) {
        console.warn('conditional passkey login failed', e);
      }
    }
  };

  verifyPasskeyResponse = async (authResponse, email) => {
    const payload = email ? { email, response: authResponse } : { response: authResponse };
    const verifyRes = await this.props.loginPasskeyActions(payload);

    if (verifyRes.payload.data.errcode === 0) {
      this.props.history.replace('/group');
      message.success('登录成功! ');
      return true;
    }

    message.error(verifyRes.payload.data.errmsg);
    return false;
  };

  tryPasskeyLogin = async email => {
    this.setState({ passkeyLoading: true });
    try {
      const optionsRes = await axios.post('/api/user/passkey/auth/options', { email });
      if (optionsRes.data.errcode !== 0) {
        return 'unavailable';
      }

      const authResponse = await startAuthentication({
        optionsJSON: optionsRes.data.data
      });
      const success = await this.verifyPasskeyResponse(authResponse, email);
      return success ? 'success' : 'failed';
    } catch (e) {
      if (isPasskeyCancelled(e)) {
        return 'cancelled';
      }
      message.error(e.message || '通行密钥登录失败');
      return 'failed';
    } finally {
      this.setState({ passkeyLoading: false });
    }
  };

  handleSubmit = e => {
    e.preventDefault();
    const form = this.props.form;
    form.validateFields(async (err, values) => {
      if (err) {
        return;
      }

      const usePasswordLogin = !this.props.isLDAP || this.state.loginType !== 'ldap';
      if (usePasswordLogin && this.state.otpRequired && !this.state.otpSent) {
        return;
      }
      if (
        usePasswordLogin &&
        !this.state.otpRequired &&
        !this.state.passkeySkipped &&
        this.state.passkeySupported
      ) {
        const email = (values.email || '').trim();
        if (email) {
          const passkeyResult = await this.tryPasskeyLogin(email);
          if (passkeyResult === 'success') {
            return;
          }
          if (passkeyResult === 'cancelled') {
            this.setState({ passkeySkipped: true });
          }
        }
      }

      if (this.props.isLDAP && this.state.loginType === 'ldap') {
        this.props.loginLdapActions(values).then(res => {
          if (res.payload.data.errcode == 0) {
            this.props.history.replace('/group');
            message.success('登录成功! ');
          }
        });
      } else {
        this.props.loginActions(values).then(res => {
          if (res.payload.data.errcode == 0) {
            this.props.history.replace('/group');
            message.success('登录成功! ');
          } else if (res.payload.data.errcode === 406) {
            const otpSent = !!(res.payload.data.data && res.payload.data.data.otp_sent);
            this.setState({ otpRequired: true, otpSent });
            message.warning(res.payload.data.errmsg);
          } else {
            message.error(res.payload.data.errmsg);
          }
        });
      }
    });
  };

  handleFormLayoutChange = e => {
    this.setState({ loginType: e.target.value });
  };

  handlePasskeyLogin = async () => {
    const email = (this.props.form.getFieldValue('email') || '').trim();
    if (!email) {
      return message.error('请输入 Email');
    }

    const result = await this.tryPasskeyLogin(email);
    if (result === 'cancelled') {
      message.info('已取消通行密钥登录');
    }
  };

  handleEmailChange = () => {
    this.clearOtpCountdown();
    this.setState({
      otpRequired: false,
      otpSent: false,
      otpCountdown: 0,
      passkeySkipped: false
    });
  };

  handleSendOtp = () => {
    if (this.state.otpCountdown > 0) {
      return;
    }
    this.props.form.validateFields(['email', 'password'], (err, values) => {
      if (err) {
        return;
      }
      this.props.loginActions({ ...values, send_otp: true }).then(res => {
        if (res.payload.data.errcode === 406) {
          this.setState({ otpRequired: true, otpSent: true });
          this.startOtpCountdown();
          message.success('验证码已发送');
        } else if (res.payload.data.errcode === 0) {
          this.props.history.replace('/group');
          message.success('登录成功! ');
        } else {
          message.error(res.payload.data.errmsg);
        }
      });
    });
  };

  render() {
    const { getFieldDecorator } = this.props.form;

    const { isLDAP } = this.props;

    const emailRule =
      this.state.loginType === 'ldap'
        ? {}
        : {
            required: true,
            message: '请输入正确的email!',
            pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{1,})+$/
          };
    return (
      <Form onSubmit={this.handleSubmit}>
        {/* 登录类型 (普通登录／LDAP登录) */}
        {isLDAP && (
          <FormItem>
            <RadioGroup defaultValue="ldap" onChange={this.handleFormLayoutChange}>
              <Radio value="ldap">LDAP</Radio>
              <Radio value="normal">普通登录</Radio>
            </RadioGroup>
          </FormItem>
        )}
        {/* 用户名 (Email) */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('email', { rules: [emailRule] })(
            <Input
              style={changeHeight}
              prefix={<Icon type="user" style={{ fontSize: 13 }} />}
              placeholder="Email"
              autoComplete="username webauthn"
              onChange={this.handleEmailChange}
            />
          )}
        </FormItem>

        {this.state.passkeySupported && (
          <FormItem style={formItemStyle}>
            <Button
              style={changeHeight}
              type="primary"
              className="login-form-button"
              loading={this.state.passkeyLoading}
              onClick={this.handlePasskeyLogin}
            >
              使用通行密钥登录
            </Button>
          </FormItem>
        )}

        {/* 密码 */}
        <FormItem style={formItemStyle}>
          {getFieldDecorator('password', {
            rules: [{ required: true, message: '请输入密码!' }]
          })(
            <Input
              style={changeHeight}
              prefix={<Icon type="lock" style={{ fontSize: 13 }} />}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
            />
          )}
        </FormItem>

        {this.state.otpRequired && this.state.otpSent && (
          <FormItem style={formItemStyle}>
            {getFieldDecorator('otp_code', {
              rules: [{ required: true, message: '请输入邮件验证码!' }]
            })(
              <Input
                style={changeHeight}
                prefix={<Icon type="mail" style={{ fontSize: 13 }} />}
                placeholder="邮件验证码"
                autoComplete="one-time-code"
              />
            )}
          </FormItem>
        )}

        <FormItem style={formItemStyle}>
          {this.state.otpRequired && !this.state.otpSent ? (
            <Button
              style={changeHeight}
              type="primary"
              className="login-form-button"
              onClick={this.handleSendOtp}
            >
              发送验证码
            </Button>
          ) : (
            <Button
              style={changeHeight}
              type="primary"
              htmlType="submit"
              className="login-form-button"
            >
              密码登录
            </Button>
          )}
        </FormItem>

        {this.state.otpRequired && this.state.otpSent && (
          <FormItem style={formItemStyle}>
            <Button
              style={changeHeight}
              className="login-secondary-button"
              disabled={this.state.otpCountdown > 0}
              onClick={this.handleSendOtp}
            >
              {this.state.otpCountdown > 0
                ? `${this.state.otpCountdown}s 后重新发送`
                : '重新发送验证码'}
            </Button>
          </FormItem>
        )}

        {/* <div className="qsso-breakline">
          <span className="qsso-breakword">或</span>
        </div>
        <Button style={changeHeight} id="qsso-login" type="primary" className="login-form-button" size="large" ghost>QSSO登录</Button> */}
      </Form>
    );
  }
}
const LoginForm = Form.create()(Login);
export default LoginForm;

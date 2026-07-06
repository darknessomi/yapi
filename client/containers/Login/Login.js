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
      otpRequired: false
    };
  }

  static propTypes = {
    form: PropTypes.object,
    history: PropTypes.object,
    loginActions: PropTypes.func,
    loginLdapActions: PropTypes.func,
    loginPasskeyActions: PropTypes.func,
    isLDAP: PropTypes.bool
  };

  handleSubmit = e => {
    e.preventDefault();
    const form = this.props.form;
    form.validateFields((err, values) => {
      if (!err) {
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
              this.setState({ otpRequired: true });
              message.warning(res.payload.data.errmsg);
            } else {
              message.error(res.payload.data.errmsg);
            }
          });
        }
      }
    });
  };

  componentDidMount() {
    //Qsso.attach('qsso-login','/api/user/login_by_token')
    console.log('isLDAP', this.props.isLDAP);
    this.setState({
      passkeySupported: browserSupportsWebAuthn()
    });
  }
  handleFormLayoutChange = e => {
    this.setState({ loginType: e.target.value });
  };

  handlePasskeyLogin = async () => {
    const email = (this.props.form.getFieldValue('email') || '').trim();
    if (!email) {
      return message.error('请输入 Email');
    }

    this.setState({ passkeyLoading: true });
    try {
      const optionsRes = await axios.post('/api/user/passkey/auth/options', { email });
      if (optionsRes.data.errcode !== 0) {
        return message.error(optionsRes.data.errmsg);
      }

      const authResponse = await startAuthentication({
        optionsJSON: optionsRes.data.data
      });
      const verifyRes = await this.props.loginPasskeyActions({
        email,
        response: authResponse
      });

      if (verifyRes.payload.data.errcode === 0) {
        this.props.history.replace('/group');
        message.success('登录成功! ');
      } else {
        message.error(verifyRes.payload.data.errmsg);
      }
    } catch (e) {
      message.error(e.message || '通行密钥登录失败');
    } finally {
      this.setState({ passkeyLoading: false });
    }
  };

  handleResendOtp = () => {
    this.props.form.validateFields(['email', 'password'], (err, values) => {
      if (err) {
        return;
      }
      this.props.loginActions(values).then(res => {
        if (res.payload.data.errcode === 406) {
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

        {this.state.otpRequired && (
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

        {/* 登录按钮 */}
        <FormItem style={formItemStyle}>
          <Button
            style={changeHeight}
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            密码登录
          </Button>
        </FormItem>

        {this.state.otpRequired && (
          <FormItem style={formItemStyle}>
            <Button
              style={changeHeight}
              className="login-secondary-button"
              onClick={this.handleResendOtp}
            >
              重新发送验证码
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

# Security Policy / 安全策略

## Supported Versions / 受支持版本

We provide security fixes for the following releases:

我们为以下版本提供安全修复：

| Version / 版本 | Supported / 是否支持 |
| ---------------- | -------------------- |
| `latest` (GHCR)  | ✅                   |
| `1.10.x`         | ✅                   |
| `< 1.10.0`       | ❌                   |

If you run a Docker image, please include the image tag (e.g. `ghcr.io/darknessomi/yapi:1.10.2`) in your report.

若使用 Docker 镜像，请在报告中注明 tag（例如 `ghcr.io/darknessomi/yapi:1.10.2`）。

## Reporting a Vulnerability / 报告漏洞

**Please do not open a public GitHub Issue for security vulnerabilities.**

**请勿在公开的 GitHub Issue 中披露安全漏洞。**

Preferred channel:

首选渠道：

1. **[GitHub Private Security Advisory](https://github.com/darknessomi/yapi/security/advisories/new)** — recommended / 推荐

Please include:

请尽量提供：

- Affected version or image tag / 受影响版本或镜像 tag
- Steps to reproduce / 复现步骤
- Impact assessment (confidentiality, integrity, availability) / 影响评估（机密性、完整性、可用性）
- Proof of concept if available / 如有 PoC 请一并附上

We aim to acknowledge reports within **7 days**. We will coordinate disclosure timing with you after validation.

我们力争在 **7 天内**确认收到报告；验证后会与你协商披露时间。

## In Scope / 适用范围

Reports are welcome for vulnerabilities in **this fork's source code and official Docker images** (`ghcr.io/darknessomi/yapi`), including but not limited to:

欢迎报告 **本 fork 源码及官方 Docker 镜像**（`ghcr.io/darknessomi/yapi`）中的漏洞，包括但不限于：

- Authentication or authorization bypass / 认证或授权绕过
- Remote code execution, SSRF, or injection / 远程代码执行、SSRF、注入类问题
- Cross-site scripting (XSS) or CSRF with demonstrable impact / 可造成实际影响的 XSS 或 CSRF
- Insecure handling of project tokens, sessions, or sensitive data / 项目 token、会话或敏感数据处理不当

## Out of Scope / 不在范围内

The following are generally **not** treated as code vulnerabilities in this repository:

以下问题通常 **不** 视为本仓库的代码漏洞：

- Deployment misconfiguration (e.g. unchanged default admin password, MongoDB exposed to the public internet, missing reverse-proxy TLS) / 部署配置不当（如未修改默认管理员密码、MongoDB 暴露公网、未配置反向代理 TLS）
- Vulnerabilities in upstream dependencies with no practical exploit path in YApi / 上游依赖漏洞且无法在 YApi 中实际利用
- Issues in third-party plugins under `exts/` unless bundled and enabled by default / `exts/` 下第三方插件的问题（除非默认打包启用）
- Original [YMFE/yapi](https://github.com/YMFE/yapi) or YApi Pro upstream — report those to their respective maintainers if still relevant / 原版 [YMFE/yapi](https://github.com/YMFE/yapi) 或 YApi Pro 上游问题，请向对应维护方报告

For deployment hardening guidance, see the [README — Deployment](https://github.com/darknessomi/yapi#部署推荐docker-compose).

部署加固建议见 [README — 部署](https://github.com/darknessomi/yapi#部署推荐docker-compose)。

## Disclosure / 披露

We follow coordinated disclosure. Please allow reasonable time for a fix before public disclosure. We credit reporters in release notes when they agree.

我们采用协调披露流程。请在公开披露前给予合理的修复时间。经报告者同意，我们会在 release notes 中致谢。

## Security Best Practices for Deployments / 部署安全建议

YApi is intended for **internal network deployment**. At minimum:

YApi 面向 **内网部署**。至少应做到：

- Change the default admin password immediately after first login / 首次登录后立即修改默认管理员密码
- Do not expose YApi or MongoDB directly to the public internet / 不要将 YApi 或 MongoDB 直接暴露到公网
- Restrict network access (VPN, firewall, reverse proxy with authentication) / 限制网络访问（VPN、防火墙、带鉴权的反向代理）
- Keep Docker images and dependencies up to date / 及时更新 Docker 镜像与依赖
- Back up MongoDB regularly / 定期备份 MongoDB

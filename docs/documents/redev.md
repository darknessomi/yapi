## 安装 YApi

1. 克隆仓库

```bash
git clone https://github.com/darknessomi/yapi.git
cd yapi
```

2. 修改配置

```bash
cp config_example.json config.json   # 复制完成后请修改相关配置
vi config.json
```

配置如下，主要配置 MongoDB 数据库，以及 Admin 账号。

```json
{
  "port": "3011",
  "adminAccount": "admin@admin.com",
  "db": {
    "servername": "127.0.0.1",
    "DATABASE":  "yapi",
    "port": 27017,
    "user": "yapi",
    "pass": "yapi123"
  },
  "mail": {
    "enable": true,
    "host": "smtp.163.com",
    "port": 465,
    "from": "***@163.com",
    "auth": {
        "user": "***@163.com",
        "pass": "*****"
    }
  }
}
```
> db.user 和 db.pass 是 mongodb 的用户名和密码，如果没有开启 mongo 认证功能，请删除这两个选项。

3. 安装依赖

```bash
npm install
```

4. 初始化

```bash
npm run install-server   # 安装程序会初始化数据库索引和管理员账号，管理员账号名可在 config.json 配置
# 默认输出
# 初始化管理员账号成功,账号名："admin@admin.com"，密码："yapi.pro"
```

5. 启动开发环境

```bash
npm run dev
# 后端 + Vite 前端 dev server，浏览器访问 http://127.0.0.1:3000
```

## 技术栈说明

后端： koa mongoose

前端： react redux vite

## 启动开发环境服务器

```bash
# 终端 1：后端
npm run dev-server

# 终端 2：前端 Vite dev server
npm run dev-client
```

## 启动生产环境服务器

```bash
npm run build-client   # 产物输出到 static/prd
node server/app.js
```

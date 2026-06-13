## 运行开发服务器

```bash
npm install
npm run dev   # 同时启动后端与 Vite 前端 dev server
```

也可以分两个终端启动：

```bash
# 终端 1：后端
npm run dev-server

# 终端 2：前端 Vite dev server（会自动生成 client/plugin-module.js）
npm run dev-client
```

浏览器访问 `http://127.0.0.1:3000`（后端）或 `http://127.0.0.1:4000/prd/`（仅前端 dev server）。

## 加载插件

在 `config.json` 的 `plugins` 配置项中加入 demo 插件：

```json
{
  "port": "3000",
  "db": {
    "servername": "127.0.0.1",
    "DATABASE": "yapi"
  },
  "plugins": [{
    "name": "demo",
    "options": {}
  }]
}
```

## 初始化目录

可参考项目 `exts/` 目录下的内置插件。

**内置插件**：放在 `exts/yapi-plugin-{name}/`，并在 `common/config.js` 的 `exts` 数组中注册。

**外部 npm 插件**：在 `node_modules/yapi-plugin-{name}/` 下安装，通过 `config.json` 的 `plugins` 启用。

目录结构示例：

```
yapi-plugin-demo
  client.js       // 客户端入口文件
  server.js       // 服务端入口文件
  package.json    // 插件依赖管理
  index.js        // 插件配置文件
```

## index.js 配置说明

```
server: true  // 如果为 true，表示该插件需要经过后端服务器加载
client: true  // 如果为 true，表示该插件需要经过前端编译
```

## server.js

在 `server.js` 需要导出一个 function，例如：`module.exports = function(options){}`

`options` 可在 `config.json` 配置。

### 绑定钩子

```
this.bindHook(hookname, listener) // 绑定钩子
hookname   // 钩子名
listener   // 监听函数，可以是普通函数，也可以是 asyncFunction
```

### 如何使用 server 目录下的模块

后端 Node 使用 CommonJS，直接 `require` 仓库根目录下的模块即可，例如：

```js
const yapi = require('yapi');
const baseController = require('controllers/base.js');
```

## controller 和 model

新增 controller 需要继承 `baseController`（`server/controllers/base.js`）。

新增 model 需要继承 `baseModel`（`server/models/base.js`）。

## client.js

前端插件由 Vite 编译。修改插件列表后需重新运行 `npm run generate-plugin-module`（`dev-client` 会自动执行）。

### 绑定钩子（同后端 server.js）

```
this.bindHook(hookname, listener) // 绑定钩子
hookname   // 钩子名
listener   // 监听函数，可以是普通函数，也可以是 asyncFunction
```

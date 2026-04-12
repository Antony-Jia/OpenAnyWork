# Proxy 代理配置使用指南

## 概述

OpenWork 现已支持全局 Proxy 代理设置,可以影响以下组件:

1. **LLM 模型调用** - OpenAI、Anthropic、Google、Ollama 等所有大模型 API 调用
2. **HTTP/HTTPS 请求** - Loop API 触发器、语音 STT/TTS、Knowledge Base 等
3. **Shell 进程执行** - Agent 执行的所有 shell 命令都会继承代理环境变量

## 代理模式

### 1. System 模式 (默认)
自动从系统环境变量读取代理设置:
- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

### 2. Manual 模式
手动指定代理服务器地址,不依赖系统环境变量。

### 3. Disabled 模式
完全禁用代理,所有请求直接发送。

## 配置示例

### 通过代码配置

```typescript
import { setProxyConfig } from "./src/main/proxy-config"

// 手动模式 - 使用 HTTP 代理
setProxyConfig({
  mode: "manual",
  httpProxy: "http://127.0.0.1:7890",
  httpsProxy: "http://127.0.0.1:7890",
  noProxy: "localhost,127.0.0.1,.local"
})

// 系统模式 - 从环境变量读取
setProxyConfig({
  mode: "system"
})

// 禁用代理
setProxyConfig({
  mode: "disabled"
})
```

### 通过前端 UI 配置 (需要实现前端界面)

前端可以通过 IPC 调用代理配置接口:

```typescript
// 获取当前代理配置
const config = await window.electronAPI.invoke("proxy:get")

// 更新代理配置
const updatedConfig = await window.electronAPI.invoke("proxy:update", {
  mode: "manual",
  httpProxy: "http://127.0.0.1:7890",
  httpsProxy: "http://127.0.0.1:7890",
  noProxy: "localhost,127.0.0.1"
})
```

## 常见代理服务器配置

### Clash for Windows
```json
{
  "mode": "manual",
  "httpProxy": "http://127.0.0.1:7890",
  "httpsProxy": "http://127.0.0.1:7890",
  "noProxy": "localhost,127.0.0.1,.local"
}
```

### V2Ray
```json
{
  "mode": "manual",
  "httpProxy": "http://127.0.0.1:10809",
  "httpsProxy": "http://127.0.0.1:10809",
  "noProxy": "localhost,127.0.0.1"
}
```

### Shadowsocks
```json
{
  "mode": "manual",
  "httpProxy": "http://127.0.0.1:1080",
  "httpsProxy": "http://127.0.0.1:1080",
  "noProxy": "localhost,127.0.0.1,.cn"
}
```

### 系统代理 (Linux/macOS)
在终端中设置环境变量:
```bash
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
export NO_PROXY=localhost,127.0.0.1,.local
```

然后在 OpenWork 中使用 `system` 模式。

### 系统代理 (Windows)
在 PowerShell 中:
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
$env:NO_PROXY="localhost,127.0.0.1"
```

## 验证代理配置

### 检查日志
启动 OpenWork 后,查看控制台日志:

```
[Proxy] Proxy config table initialized
[Proxy] Fetch proxy applied: http://127.0.0.1:7890
[Runtime] Using proxy for LLM requests
```

### 测试 LLM 调用
发送一条测试消息,观察是否正常通过代理访问大模型。

### 测试 Shell 命令
在 Agent 中执行以下命令验证代理环境变量是否注入:

```bash
# Linux/macOS
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Windows PowerShell
echo $env:HTTP_PROXY
echo $env:HTTPS_PROXY
```

## 技术实现细节

### 1. LLM 调用代理
使用 `hpagent` 库为 `ChatOpenAI` 创建 HTTP/HTTPS Agent,所有大模型 API 请求都会通过代理发送。

### 2. Shell 进程代理
在 `LocalSandbox` 启动 shell 进程时,自动注入代理环境变量到子进程的 `env` 中。

### 3. Fetch 请求代理
通过重写 `globalThis.fetch` 函数,为所有 HTTP/HTTPS 请求应用代理设置。

### 4. 本地地址绕过
`localhost`、`127.0.0.1`、`::1` 以及在 `noProxy` 列表中配置的地址会自动绕过代理。

## 数据库存储

代理配置存储在 SQLite 数据库的 `proxy_config` 表中:

```sql
CREATE TABLE IF NOT EXISTS proxy_config (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL
)
```

配置以 JSON 格式存储在 `data` 字段中。

## 故障排查

### 问题: 代理不生效

1. 检查代理配置是否正确保存:
   ```typescript
   const config = await window.electronAPI.invoke("proxy:get")
   console.log(config)
   ```

2. 确认代理服务器正在运行
3. 检查防火墙设置是否阻止了连接

### 问题: 某些请求没有走代理

确认以下情况:
- LLM 调用: 已配置代理并且 `hpagent` 已安装
- Shell 命令: 进程环境变量已继承
- Fetch 请求: `globalThis.fetch` 已被正确重写

### 问题: 本地服务无法访问

检查 `noProxy` 配置,确保本地开发服务器地址在排除列表中:

```json
{
  "noProxy": "localhost,127.0.0.1,::1,.local,0.0.0.0"
}
```

## 安全注意事项

- 代理配置存储在本地数据库中,不会被加密
- 不要在代理配置中存储敏感信息
- 如果代理服务器需要认证,确保使用安全的本地代理工具

## 更多资源

- [hpagent 文档](https://github.com/delvedor/hpagent)
- [Node.js HTTP 代理指南](https://nodejs.org/api/http.html)
- [Electron 网络请求文档](https://www.electronjs.org/docs/latest/api/net)

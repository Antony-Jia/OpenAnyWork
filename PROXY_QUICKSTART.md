# 🚀 Proxy 代理快速开始指南

## 5 分钟快速配置代理

### 场景 1: 使用 Clash/V2Ray 等本地代理工具

如果你已经在使用 Clash、V2Ray、Shadowsocks 等本地代理工具:

#### 步骤 1: 确认代理端口
打开你的代理工具,找到本地监听端口:
- **Clash for Windows**: 通常 `7890`
- **V2Ray**: 通常 `10809`
- **Shadowsocks**: 通常 `1080`

#### 步骤 2: 在 OpenWork 中配置
在 OpenWork 启动后,通过开发者控制台或前端 UI 执行:

```javascript
// 方式 1: 通过控制台 (开发模式)
const { setProxyConfig } = require("./out/main/proxy-config")
setProxyConfig({
  mode: "manual",
  httpProxy: "http://127.0.0.1:7890",  // 改成你的端口
  httpsProxy: "http://127.0.0.1:7890",
  noProxy: "localhost,127.0.0.1,.local"
})
```

或使用系统模式(推荐):
```javascript
// 方式 2: 先设置系统环境变量,然后使用 system 模式
// Windows PowerShell:
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"

// 然后在 OpenWork 中配置:
setProxyConfig({ mode: "system" })
```

### 场景 2: 公司/学校网络代理

如果你的网络需要通过公司或学校的代理服务器:

```javascript
setProxyConfig({
  mode: "manual",
  httpProxy: "http://proxy.yourcompany.com:8080",
  httpsProxy: "http://proxy.yourcompany.com:8080",
  noProxy: "localhost,127.0.0.1,.yourcompany.com"
})
```

### 场景 3: 不需要代理

如果你在国内或可以直接访问 OpenAI API:

```javascript
setProxyConfig({ mode: "disabled" })
```

## ✅ 验证代理是否生效

### 1. 检查日志
启动 OpenWork 后查看控制台:

```bash
npm run dev
```

应该看到:
```
[Proxy] Proxy config table initialized
[Proxy] Fetch proxy applied: http://127.0.0.1:7890
[Runtime] Using proxy for LLM requests
```

### 2. 测试 LLM 调用
在 OpenWork 中发送一条消息,如果代理配置正确,应该能正常收到回复。

### 3. 检查 Shell 环境变量
在 OpenWork 中执行:

```bash
# Windows PowerShell
echo $env:HTTP_PROXY

# Linux/macOS
echo $HTTP_PROXY
```

应该显示你配置的代理地址。

## 🔧 常见端口参考

| 代理工具 | 默认 HTTP 端口 | 默认 SOCKS 端口 |
|---------|--------------|----------------|
| Clash for Windows | 7890 | 7891 |
| V2Ray | 10809 | 10808 |
| Shadowsocks | 1080 | 1080 |
| Surge | 6152 | 6153 |
| Quantumult X | 6152 | 6153 |

## ⚠️ 注意事项

1. **端口号**: 确保使用正确的端口,不同代理工具端口可能不同
2. **协议前缀**: 代理地址必须包含 `http://` 或 `https://`
3. **本地地址**: 确保 `localhost` 和 `127.0.0.1` 在 `noProxy` 列表中
4. **防火墙**: 确保防火墙允许 OpenWork 访问代理服务器
5. **代理状态**: 确保代理工具正在运行

## 🐛 故障排除

### 问题: 连接超时
- 检查代理工具是否正在运行
- 确认端口是否正确
- 检查防火墙设置

### 问题: 本地服务无法访问
- 确保本地开发服务器地址在 `noProxy` 列表中
- 添加 `.local` 和 `0.0.0.0` 到排除列表

### 问题: 代理不生效
- 重启 OpenWork 应用
- 检查配置是否正确保存
- 查看日志确认代理是否被正确加载

## 📚 更多资源

- 详细文档: 查看 `PROXY_SETUP.md`
- 实现细节: 查看 `PROXY_IMPLEMENTATION.md`
- 技术支持: 提交 Issue 或联系开发团队

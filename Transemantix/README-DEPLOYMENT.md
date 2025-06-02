# Transemantix 部署指南

## 发布到 npm

### 1. 准备发布

首先确保您有 npm 账户并已登录：

```bash
npm login
```

### 2. 更新版本号

在发布前更新版本号：

```bash
npm version patch  # 或 minor, major
```

### 3. 发布包

```bash
npm publish
```

如果包名已被占用，可以使用作用域包名：

```json
{
  "name": "@your-username/transemantix",
  "version": "1.0.0"
}
```

然后发布：

```bash
npm publish --access public
```

## 使用已发布的包

### 通过 npx 使用

```bash
npx transemantix --token YOUR_DEEPSEEK_API_KEY
```

### 在 MCP 配置中使用

在 `mcp.json` 中配置：

```json
{
  "mcpServers": {
    "transemantix": {
      "command": "npx",
      "args": ["-y", "transemantix", "--token", "YOUR_DEEPSEEK_API_KEY"]
    }
  }
}
```

## 获取 DeepSeek API Key

1. 访问 [DeepSeek 官网](https://platform.deepseek.com/)
2. 注册账户并登录
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制 API Key（格式通常为 `sk-xxxxxxxxxxxxxxxx`）

## 注意事项

- API Key 是敏感信息，请妥善保管
- 建议在生产环境中使用环境变量存储 API Key
- 包发布后，其他用户可以通过 npx 直接使用，无需本地安装

# codex-multi

通过独立 `CODEX_HOME` 管理多个 Codex CLI API 账号，并为每个账号生成 zsh 快捷命令。

## 安装

发布到 npm 后：

```zsh
npm install -g codex-multi-cli
```

本地开发安装：

```zsh
npm install -g .
```

要求 Node.js 18+，并且 `codex` 已经在 PATH 中。

## 新建 API 账号

交互式输入 API key（输入时不回显）：

```zsh
codex-multi add api-b \
  --base-url https://host.example.com/v1 \
  --model your-model-id \
  --shortcut codex-b
```

也可以从环境变量读取 key，避免 key 出现在命令行参数中：

```zsh
export API_B_KEY='临时设置，使用后立即 unset'
codex-multi add api-b \
  --base-url https://host.example.com/v1 \
  --model your-model-id \
  --shortcut codex-b \
  --api-key-env API_B_KEY
unset API_B_KEY
```

命令会：

1. 创建 `~/.codex-accounts/api-b/`。
2. 写入 `config.toml`，包含 provider、默认模型、`base_url` 和 Responses API 配置。
3. 调用 `codex login --with-api-key` 保存认证凭据。
4. 在 `~/.zshrc` 的托管区块写入 `codex-b` 别名。

加载别名：

```zsh
source ~/.zshrc
codex-b
```

只生成配置、不登录：

```zsh
codex-multi add api-b --base-url https://host.example.com/v1 --model your-model-id --shortcut codex-b --no-login
```

## 管理

```zsh
codex-multi list
codex-multi path api-b
codex-multi remove api-b
```

`remove` 只移除托管快捷命令，不删除账号目录和认证凭据。

## 完整教程

- [Markdown 配置指南](docs/account-guide.md)
- [HTML 配置指南](docs/account-guide.html)

## 配置文件

每个账号的 `config.toml` 类似：

```toml
model_provider = "api_b"
model = "your-model-id"
model_reasoning_effort = "medium"
personality = "pragmatic"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.api_b]
name = "api_b"
base_url = "https://host.example.com/v1"
wire_api = "responses"
requires_openai_auth = true
```

服务商必须提供 OpenAI Responses API 兼容接口，例如 `POST {base_url}/responses`。只支持 `/chat/completions` 的服务不能仅靠修改 `base_url` 使用。

## 自定义目录

```zsh
CODEX_MULTI_HOME="$HOME/.config/codex-accounts" codex-multi list
CODEX_MULTI_ZSHRC="$HOME/.zshrc.local" codex-multi add api-b
```

不要把 API key 写入 `config.toml`、`.zshrc`、Git 或 shell history。认证由 Codex 自己保存，通常是账号目录中的 `auth.json` 或系统钥匙串。

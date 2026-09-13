# Codex CLI 多账号切换使用指南

本指南适用于 macOS 上的 Codex CLI，管理一个 ChatGPT 登录账号，以及两个使用不同 base_url 的 API key。推荐用不同的 CODEX_HOME 隔离认证、配置和会话：

~~~text
ChatGPT  -> ~/.codex-accounts/chatgpt
API A    -> ~/.codex-accounts/api-a
API B    -> ~/.codex-accounts/api-b
~~~

切换通过 zsh 别名完成。API key 不写入 ~/.zshrc、别名或 config.toml。

## 1. 检查环境

~~~zsh
codex --version
echo "$SHELL"
~~~

本文按 zsh 编写，iTerm2 和 Warp 都适用。

## 2. 创建目录

~~~zsh
mkdir -p "$HOME/.codex-accounts/chatgpt"
mkdir -p "$HOME/.codex-accounts/api-a"
mkdir -p "$HOME/.codex-accounts/api-b"

chmod 700 "$HOME/.codex-accounts/chatgpt"
chmod 700 "$HOME/.codex-accounts/api-a"
chmod 700 "$HOME/.codex-accounts/api-b"
~~~

如果现有 ChatGPT 登录已经在 ~/.codex，可以继续使用它，不必迁移；后文会给出对应别名。

## 3. 登录 ChatGPT

独立目录登录：

~~~zsh
CODEX_HOME="$HOME/.codex-accounts/chatgpt" codex login
CODEX_HOME="$HOME/.codex-accounts/chatgpt" codex login status
~~~

浏览器登录完成后，ChatGPT 配置不需要手动设置 provider 或 base_url。

如果继续使用默认目录 ~/.codex，验证命令是：

~~~zsh
CODEX_HOME="$HOME/.codex" codex login status
~~~

## 4. 配置 API A

编辑文件：

~~~zsh
nano "$HOME/.codex-accounts/api-a/config.toml"
~~~

内容如下，将模型名和地址替换为真实值：

~~~toml
model_provider = "api_a"
model = "供应商提供的模型名称"
model_reasoning_effort = "high"
personality = "pragmatic"

approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.api_a]
name = "API A"
base_url = "https://api-a.example.com/v1"
wire_api = "responses"
requires_openai_auth = true
~~~

base_url 填 API 根地址，例如 https://host.example.com/v1，不要追加 /responses。

## 5. 配置 API B

编辑文件：

~~~zsh
nano "$HOME/.codex-accounts/api-b/config.toml"
~~~

内容如下：

~~~toml
model_provider = "api_b"
model = "供应商提供的模型名称"
model_reasoning_effort = "high"
personality = "pragmatic"

approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.api_b]
name = "API B"
base_url = "https://api-b.example.com/v1"
wire_api = "responses"
requires_openai_auth = true
~~~

API A 和 API B 的 base_url 可以完全不同，由各自的 provider 段决定。

## 6. 配置字段说明

| 字段 | 位置 | 推荐值/示例 | 说明 |
| --- | --- | --- | --- |
| model_provider | 顶层 | "api_a" | 选择 provider ID，必须与 model_providers 下的名称一致。ChatGPT 登录通常不需要设置。 |
| model | 顶层 | "供应商提供的模型名称" | 默认模型，必须是该服务商实际支持的模型名。 |
| model_reasoning_effort | 顶层 | "medium" 或 "high" | 推理强度；high 适合复杂编码，medium 通常更快。 |
| personality | 顶层 | "pragmatic" | 交互风格，不影响鉴权和地址。 |
| approval_policy | 顶层 | "on-request" | 命令执行审批策略，推荐按需审批。 |
| sandbox_mode | 顶层 | "workspace-write" | shell 沙箱权限，编码项目通常使用工作区可写。 |
| name | provider 段 | "API A" | provider 显示名称，便于识别，不是 key。 |
| base_url | provider 段 | "https://host.example.com/v1" | API 根地址，不要写 /responses。 |
| wire_api | provider 段 | "responses" | 请求协议。服务商需要兼容 OpenAI Responses API。 |
| requires_openai_auth | provider 段 | true | 使用 Codex 的 OpenAI 风格认证存储，适配 login --with-api-key。 |
| env_key | provider 段 | 可选 | 只有服务商要求从环境变量读取 key 时才设置；已用 codex login 保存 key 时通常不需要。 |
| service_tier | 顶层 | 按服务商支持情况 | 第三方 provider 未必支持，不要盲目复制 fast。 |
| check_for_update_on_startup | 顶层 | true | 启动时检查更新，不影响模型请求。 |
| cli_auth_credentials_store | 顶层 | 通常省略 | 凭据存储方式，省略时使用当前版本默认行为。 |
| [features] | 表 | 按需开启 | 功能开关，优先使用稳定默认值。 |

最小可用配置是 model_provider、model、provider 段的 base_url、wire_api 和 requires_openai_auth；其余字段按习惯调整。

## 7. 安全录入 API key

API A：

~~~zsh
read -rs "CODEX_KEY?API key A: "
printf '\n'
printf '%s' "$CODEX_KEY" |
  CODEX_HOME="$HOME/.codex-accounts/api-a" codex login --with-api-key
unset CODEX_KEY
~~~

API B：

~~~zsh
read -rs "CODEX_KEY?API key B: "
printf '\n'
printf '%s' "$CODEX_KEY" |
  CODEX_HOME="$HOME/.codex-accounts/api-b" codex login --with-api-key
unset CODEX_KEY
~~~

输入时不会回显字符，完成后按 Enter。凭据通常保存在对应目录的 auth.json，也可能保存在 macOS Keychain。不要把 key 写入命令历史、配置文件或文档。

验证：

~~~zsh
CODEX_HOME="$HOME/.codex-accounts/api-a" codex login status
CODEX_HOME="$HOME/.codex-accounts/api-b" codex login status
~~~

## 8. 设置别名

编辑 ~/.zshrc：

~~~zsh
nano "$HOME/.zshrc"
~~~

ChatGPT 使用独立目录时加入：

~~~zsh
alias codex-chatgpt='CODEX_HOME="$HOME/.codex-accounts/chatgpt" codex'
alias codex-a='CODEX_HOME="$HOME/.codex-accounts/api-a" codex'
alias codex-b='CODEX_HOME="$HOME/.codex-accounts/api-b" codex'
~~~

如果 ChatGPT 仍在默认目录 ~/.codex，把第一行替换为：

~~~zsh
alias codex-chatgpt='CODEX_HOME="$HOME/.codex" codex'
~~~

加载并检查：

~~~zsh
source "$HOME/.zshrc"
type codex-chatgpt
type codex-a
type codex-b
~~~

## 9. 日常切换

~~~zsh
codex-chatgpt
codex-a
codex-b

codex-a exec "检查当前项目"
codex-b exec "运行测试并总结结果"

codex-chatgpt login status
codex-a login status
codex-b login status
~~~

三个窗口可以同时运行不同账号，互不覆盖认证和会话。

## 10. Base URL 兼容性

配置 wire_api = "responses" 后，服务商至少要能处理：

~~~text
POST {base_url}/responses
~~~

如果服务商只支持 /chat/completions，仅修改 base_url 通常不够，应使用其 Codex/Responses 兼容入口或兼容层。

## 11. ChatGPT 客户端与终端

ChatGPT macOS/Web 客户端与 CLI shell 配置独立：

- ChatGPT 客户端只显示它自身登录的 ChatGPT 账号。
- API A、API B 不会出现在 ChatGPT 客户端账号切换菜单。
- API 用量和费用归属于对应 API key 的平台账号。
- CLI 别名不会被图形客户端识别。

iTerm2 和 Warp 都能使用这些别名。已打开的窗口执行：

~~~zsh
source "$HOME/.zshrc"
~~~

新窗口通常会自动加载。

## 12. 故障排查

401/403：检查 key 有效期、权限和服务商账号。

404：检查 base_url 是否为 API 根地址，以及 /responses 路径是否存在。

模型不存在：检查 model 是否是服务商实际支持的名称。

显示错误账号：

~~~zsh
CODEX_HOME="$HOME/.codex-accounts/api-b" codex login status
alias codex-b
~~~

别名不存在：

~~~zsh
source "$HOME/.zshrc"
type codex-a
~~~

## 13. 最终目录结构

~~~text
~/.codex-accounts/
├── chatgpt/
│   ├── config.toml
│   └── auth.json 或系统钥匙串凭据
├── api-a/
│   ├── config.toml
│   └── auth.json 或系统钥匙串凭据
└── api-b/
    ├── config.toml
    └── auth.json 或系统钥匙串凭据
~~~

## 14. 使用 codex-multi 自动创建账号

本目录还包含一个可通过 npm 安装的命令行工具。要求 Node.js 18+，并且 `codex` 已在 PATH 中。

~~~zsh
npm install -g codex-multi-cli
~~~

创建 API 账号。命令会隐藏输入 API key，写入对应 `CODEX_HOME`，生成 `config.toml`，并在 `~/.zshrc` 的托管区块中加入快捷命令：

~~~zsh
codex-multi add api-b \
  --base-url https://host.example.com/v1 \
  --model your-model-id \
  --shortcut codex-b
~~~

也可以通过 `--api-key-env API_B_KEY` 从环境变量读取 key。管理账号：

~~~zsh
codex-multi list
codex-multi path api-b
codex-multi remove api-b
~~~

`remove` 只移除托管快捷命令，不删除账号目录或认证凭据。

参考：

- OpenAI Codex Authentication: https://developers.openai.com/codex/auth
- OpenAI Codex Configuration Reference: https://developers.openai.com/codex/config-reference/

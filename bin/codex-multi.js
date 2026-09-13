#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawnSync } from "node:child_process";

const home = os.homedir();
const accountsRoot = path.resolve(process.env.CODEX_MULTI_HOME || path.join(home, ".codex-accounts"));
const zshrc = process.env.CODEX_MULTI_ZSHRC || path.join(home, ".zshrc");
const markerStart = "# >>> codex-multi managed aliases >>>";
const markerEnd = "# <<< codex-multi managed aliases <<<";

function usage() {
  console.log(`codex-multi - manage isolated Codex CLI accounts

Usage:
  codex-multi add <name> [options]       Create/update an API account
  codex-multi list                       List configured accounts
  codex-multi remove <name>              Remove its managed shortcut
  codex-multi path <name>                Print the account CODEX_HOME

add options:
  --base-url <url>       API root, e.g. https://host.example.com/v1
  --api-key-env <name>   Read the key from this environment variable
  --model <id>           Default model id
  --shortcut <command>   Shell alias, e.g. codex-b
  --no-login             Only write config; skip codex login

Environment:
  CODEX_MULTI_HOME       Account root (default: ~/.codex-accounts)
  CODEX_MULTI_ZSHRC      zsh file to update (default: ~/.zshrc)
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--no-login") result.noLogin = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replaceAll("-", "_");
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      result[key] = value;
      i += 1;
    } else result._.push(arg);
  }
  return result;
}

function validateName(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error("账号名只能包含字母、数字、下划线和短横线");
  }
}

function validateShortcut(shortcut) {
  if (!/^[a-zA-Z0-9_-]+$/.test(shortcut)) throw new Error("快捷命令只能包含字母、数字、下划线和短横线");
}

function validateBaseUrl(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("baseUrl 必须是 http 或 https 地址");
  return value.replace(/\/$/, "");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function aliasLine(shortcut, dir) {
  return `alias ${shortcut}='CODEX_HOME="${dir.replaceAll('"', '\\"')}" codex'`;
}

function readManagedAliases() {
  if (!fs.existsSync(zshrc)) return [];
  const text = fs.readFileSync(zshrc, "utf8");
  const start = text.indexOf(markerStart);
  const end = text.indexOf(markerEnd);
  if (start < 0 || end < start) return [];
  return text.slice(start + markerStart.length, end).split("\n").map((line) => line.trim()).filter((line) => line.startsWith("alias "));
}

function writeManagedAliases(lines) {
  const existing = fs.existsSync(zshrc) ? fs.readFileSync(zshrc, "utf8") : "";
  const block = `${markerStart}\n${lines.join("\n")}\n${markerEnd}`;
  const start = existing.indexOf(markerStart);
  const end = existing.indexOf(markerEnd);
  let next;
  if (start >= 0 && end >= start) next = `${existing.slice(0, start)}${block}${existing.slice(end + markerEnd.length)}`;
  else next = `${existing.trimEnd()}\n\n${block}\n`;
  fs.mkdirSync(path.dirname(zshrc), { recursive: true });
  fs.writeFileSync(zshrc, next, { mode: 0o600 });
}

function configText(provider, model, baseUrl) {
  return `model_provider = "${provider}"\nmodel = "${model.replaceAll('"', '\\"')}"\nmodel_reasoning_effort = "medium"\npersonality = "pragmatic"\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n\n[model_providers.${provider}]\nname = "${provider}"\nbase_url = "${baseUrl}"\nwire_api = "responses"\nrequires_openai_auth = true\n`;
}

async function promptHidden(question) {
  if (!input.isTTY || !output.isTTY) throw new Error("API key 缺失且当前不是交互式终端，请使用 --api-key-env");
  output.write(question);
  input.setRawMode(true);
  input.resume();
  return await new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("已取消"));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(value.trim());
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    input.on("data", onData);
  });
}

async function promptLine(question, fallback) {
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim();
  rl.close();
  return answer || fallback;
}

async function addAccount(args) {
  const name = args._[1];
  if (!name) throw new Error("请提供账号名，例如 codex-multi add api-b");
  validateName(name);
  const baseUrl = validateBaseUrl(args.base_url || await promptLine("baseUrl (例如 https://host.example.com/v1)"));
  const model = args.model || await promptLine("默认模型 id");
  if (!model) throw new Error("默认模型 id 不能为空");
  const shortcut = args.shortcut || await promptLine("启用账号的快捷命令", `codex-${name}`);
  validateShortcut(shortcut);
  const dir = path.join(accountsRoot, name);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, "config.toml"), configText(name, model, baseUrl), { mode: 0o600 });

  if (!args.noLogin) {
    const key = args.api_key_env ? process.env[args.api_key_env] : await promptHidden("API key: ");
    if (!key) throw new Error(args.api_key_env ? `环境变量 ${args.api_key_env} 为空` : "API key 不能为空");
    const login = spawnSync("codex", ["login", "--with-api-key"], { env: { ...process.env, CODEX_HOME: dir }, input: `${key}\n`, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    if (login.error) throw login.error;
    if (login.status !== 0) throw new Error(`codex login 失败，退出码 ${login.status}`);
  }

  const aliases = readManagedAliases().filter((line) => !line.startsWith(`alias ${shortcut}=`));
  aliases.push(aliasLine(shortcut, dir));
  writeManagedAliases(aliases.sort());
  console.log(`已配置 ${name}`);
  console.log(`  CODEX_HOME: ${dir}`);
  console.log(`  快捷命令: ${shortcut}`);
  console.log(`  使别名生效: source ${shellQuote(zshrc)}`);
  if (args.noLogin) console.log("  已跳过登录，请稍后执行 codex login --with-api-key");
}

function listAccounts() {
  if (!fs.existsSync(accountsRoot)) return console.log("暂无账号");
  const entries = fs.readdirSync(accountsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (!entries.length) return console.log("暂无账号");
  for (const entry of entries) console.log(`${entry.name}\t${path.join(accountsRoot, entry.name)}`);
}

function removeShortcut(name) {
  validateName(name);
  const lines = readManagedAliases();
  const dir = path.join(accountsRoot, name);
  const next = lines.filter((line) => !line.includes(`CODEX_HOME="${dir}"`));
  if (next.length === lines.length) throw new Error(`没有找到 ${name} 的托管快捷命令`);
  writeManagedAliases(next);
  console.log(`已移除 ${name} 的快捷命令；账号目录仍保留：${dir}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || command === "help" || command === "--help") return usage();
  if (command === "add") return addAccount(args);
  if (command === "list") return listAccounts();
  if (command === "remove") return removeShortcut(args._[1]);
  if (command === "path") {
    validateName(args._[1]);
    return console.log(path.join(accountsRoot, args._[1]));
  }
  throw new Error(`未知命令: ${command}`);
}

main().catch((error) => fail(error.message));

#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseArgs } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析命令行参数
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    token: {
      type: "string",
      short: "t",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  allowPositionals: true,
});

// 显示帮助信息
if (values.help) {
  console.log(`
Transemantix - 汉语翻译为符合语义化的英文命名工具

使用方法:
  npx transemantix --token YOUR_DEEPSEEK_API_KEY
  npx transemantix -t YOUR_DEEPSEEK_API_KEY

参数:
  --token, -t    DeepSeek API Key (必需)
  --help, -h     显示帮助信息

示例:
  npx transemantix --token sk-xxxxxxxxxxxxxxxx
`);
  process.exit(0);
}

// 检查是否提供了 token
if (!values.token) {
  console.error("错误: 必须提供 DeepSeek API Key");
  console.error("使用 --help 查看使用说明");
  process.exit(1);
}

// 设置环境变量并启动服务器
const serverPath = join(__dirname, "..", "src", "server.js");
const child = spawn("node", [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    DEEPSEEK_API_KEY: values.token,
  },
});

// 处理子进程退出
child.on("exit", (code) => {
  process.exit(code);
});

// 处理进程信号
process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import express from "express";
import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志记录函数 - 写入临时文件而不是控制台输出
function logToFile(message) {
  const logPath = "/tmp/transemantix-log.txt";
  fs.appendFileSync(logPath, new Date().toISOString() + ": " + message + "\n");
}

logToFile("当前目录: " + __dirname);
logToFile(
  "环境变量状态: " +
    JSON.stringify({
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? "已设置" : "未设置",
      API_KEY_LENGTH: process.env.DEEPSEEK_API_KEY
        ? process.env.DEEPSEEK_API_KEY.length
        : 0,
    })
);

// 检查 API Key 是否设置
if (!process.env.DEEPSEEK_API_KEY) {
  logToFile("错误: 未设置 DEEPSEEK_API_KEY 环境变量");
  logToFile("请通过 --token 参数提供 DeepSeek API Key");
  process.exit(1);
}

// 初始化 DeepSeek 客户端 (使用与 OpenAI 兼容的 SDK)
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

async function translateWithDeepSeek(chineseText, style) {
  try {
    logToFile(`开始翻译: ${chineseText}, 样式: ${style}`);

    const prompt = `请将以下中文文本翻译成适合编程使用的英文命名：${chineseText}
要求：
1. 翻译要准确表达原意
2. 使用专业的编程术语
3. 返回格式为 ${style}
4. 只返回翻译结果，不要其他解释`;

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的编程命名翻译助手。请直接返回翻译结果，不要添加任何解释。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const result = response.choices[0].message.content.trim();
    logToFile(`翻译结果: ${result}`);
    return result;
  } catch (error) {
    logToFile("DeepSeek API 调用失败: " + error.message);
    throw new Error(`翻译服务暂时不可用: ${error.message}`);
  }
}

// 创建服务器
const server = new McpServer({
  name: "transemantix",
  version: "1.0.0",
  description: "基于 DeepSeek 的中英文编程命名翻译工具",
});

// 定义翻译工具
server.tool(
  "translate",
  {
    input: z.string().describe("需要翻译的中文短语"),
    style: z
      .enum(["camelCase", "PascalCase", "snake_case", "kebab-case"])
      .default("camelCase")
      .describe("命名风格"),
    returnMultipleStyles: z
      .boolean()
      .default(true)
      .describe("是否返回多种风格（camelCase和PascalCase）"),
  },
  async ({ input, style, returnMultipleStyles }) => {
    try {
      let result;

      // 如果需要返回多种风格
      if (returnMultipleStyles) {
        const camelResult = await translateWithDeepSeek(input, "camelCase");
        const pascalResult = await translateWithDeepSeek(input, "PascalCase");

        result = {
          camelCase: camelResult,
          PascalCase: pascalResult,
          selected: style === "camelCase" ? camelResult : pascalResult,
        };

        logToFile("翻译完成，结果: " + JSON.stringify(result));
        return {
          content: [
            {
              type: "text",
              text: `翻译结果：
camelCase: ${result.camelCase}
PascalCase: ${result.PascalCase}
selected (${style}): ${result.selected}`,
            },
          ],
        };
      } else {
        // 原有逻辑
        result = await translateWithDeepSeek(input, style);
        logToFile("翻译完成，结果: " + result);
        return {
          content: [
            {
              type: "text",
              text: `翻译结果 (${style}): ${result}`,
            },
          ],
        };
      }
    } catch (error) {
      logToFile("翻译错误: " + error.message);
      return {
        content: [
          {
            type: "text",
            text: `翻译失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// 定义批量翻译工具
server.tool(
  "batch-translate",
  {
    inputs: z.array(z.string()).describe("需要翻译的中文短语列表"),
    style: z
      .enum(["camelCase", "PascalCase", "snake_case", "kebab-case"])
      .default("camelCase")
      .describe("命名风格"),
    returnMultipleStyles: z
      .boolean()
      .default(true)
      .describe("是否返回多种风格（camelCase和PascalCase）"),
  },
  async ({ inputs, style, returnMultipleStyles }) => {
    try {
      let results;

      // 如果需要返回多种风格
      if (returnMultipleStyles) {
        results = await Promise.all(
          inputs.map(async (input) => {
            const camelResult = await translateWithDeepSeek(input, "camelCase");
            const pascalResult = await translateWithDeepSeek(
              input,
              "PascalCase"
            );

            return {
              original: input,
              camelCase: camelResult,
              PascalCase: pascalResult,
              selected: style === "camelCase" ? camelResult : pascalResult,
            };
          })
        );

        const resultText = results
          .map(
            (item) =>
              `原文: ${item.original}
  camelCase: ${item.camelCase}
  PascalCase: ${item.PascalCase}
  selected (${style}): ${item.selected}`
          )
          .join("\n\n");

        return {
          content: [{ type: "text", text: `批量翻译结果:\n\n${resultText}` }],
        };
      } else {
        // 原有逻辑
        results = await Promise.all(
          inputs.map(async (input) => {
            const translated = await translateWithDeepSeek(input, style);
            return { original: input, translated };
          })
        );

        const resultText = results
          .map((item) => `${item.original} -> ${item.translated}`)
          .join("\n");

        return {
          content: [
            { type: "text", text: `批量翻译结果 (${style}):\n${resultText}` },
          ],
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `批量翻译失败: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// 捕获全局错误
process.on("uncaughtException", (error) => {
  logToFile(`未捕获的异常: ${error.stack || error.message || error}`);
});

// 启动服务器函数
async function startServer() {
  try {
    const serverType = process.env.SERVER_TYPE || "stdio";

    if (serverType === "http") {
      // HTTP/SSE 模式
      const app = express();
      app.use(express.json());

      const transports = {};

      app.get("/sse", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;

        res.on("close", () => {
          delete transports[transport.sessionId];
        });

        server.connect(transport).catch((err) => {
          logToFile(`SSE 连接错误: ${err.message}`);
        });
      });

      app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send("无效的会话 ID");
          return;
        }

        try {
          await transports[sessionId].handlePostMessage(req, res);
        } catch (error) {
          logToFile(`消息处理错误: ${error.message}`);
          res.status(500).send("服务器错误");
        }
      });

      const port = 3008;
      app.listen(port);
      logToFile(`HTTP 服务器已启动，端口: ${port}`);
    } else {
      // 标准输入输出模式
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logToFile("标准输入输出服务器已启动");
    }
  } catch (error) {
    logToFile(`服务器启动错误: ${error.stack || error.message || error}`);
    process.exit(1);
  }
}

// 启动服务器
startServer();

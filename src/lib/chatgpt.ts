import type { ChatMessage, SendMessageOptions } from "chatgpt";
import { ChatGPTAPI } from "chatgpt";
import { serverEnvs } from "@/utils";

export interface RequestOptions {
  message: string;
  payload?: Record<string, any>;
  signal?: AbortSignal;
  process?: (chat: ChatMessage) => void;
  systemMessage?: string;
  temperature?: number;
  top_p?: number;
}

const ErrorCodeMessage: Record<string, string> = {
  401: "[OpenAI] 提供错误的API密钥 | Incorrect API key provided",
  403: "[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later",
  502: "[OpenAI] 错误的网关 |  Bad Gateway",
  503: "[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later",
  504: "[OpenAI] 网关超时 | Gateway Time-out",
  500: "[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error",
};

const timeoutMs: number = !isNaN(+serverEnvs.TIMEOUT_MS)
  ? +serverEnvs.TIMEOUT_MS
  : 100 * 1000;

const api = new ChatGPTAPI({
  apiBaseUrl: serverEnvs.BASE_URL,
  apiKey: serverEnvs.API_KEY,
  fetch: (url, options) => {
    return fetch(url, { ...options });
  },
});

// * 手写实现 废弃
export async function chatFetch(options: RequestOptions) {
  const { message, process, signal, payload } = options;
  let fullResponse = "";
  let lastResponse = "";

  const response = await fetch(serverEnvs.BASE_URL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnvs.API_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      ...payload,
    }),
    signal: signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  for await (const chunk of response.body as any) {
    const parsedLines = new TextDecoder()
      .decode(chunk)
      .split("\n")
      .filter((line) => line.trim() !== "");

    for (const line of parsedLines) {
      let event = "unknown";
      // console.log("🚀 ~ chat ~ line ~ ", line);

      if (line.startsWith("data: ")) {
        lastResponse = line;
        const dataContent = line.split("data: ")[1];
        if (!dataContent) continue;
        if (dataContent === "[DONE]") {
          //   await stream.writeSSE({
          //     data: JSON.stringify({
          //       event: "text-done",
          //     }),
          //   });
          continue;
        }

        // * Pre-process the dataContent
        try {
          const parsed = JSON.parse(dataContent);
          const text = parsed.choices?.[0]?.delta?.content || "";
          if (!text) continue;

          fullResponse = fullResponse + text;
          process?.(text);
          //   await stream.writeSSE({
          //     data: JSON.stringify({
          //       event: "message",
          //       data: text,
          //     }),
          //   });
        } catch (error) {
          console.error("🚨 ~ 解析JSON时出错:");
        }
      }
    }
  }
}

export default async function chatReplyProcess(options: RequestOptions) {
  const { message, process, signal, payload, systemMessage } = options;
  const opts: SendMessageOptions = {
    timeoutMs,
    stream: true,
    abortSignal: signal,
    completionParams: payload,
    systemMessage: systemMessage,
    onProgress: (partialResponse) => {
      process?.(partialResponse);
    },
  };

  try {
    const response = await api.sendMessage(message, opts);
    console.log("🚀 ~ chatReplyProcess ~ response", response);
    return response;
  } catch (error: any) {
    const code = error.statusCode;
    global.console.log(error);
    if (Reflect.has(ErrorCodeMessage, code))
      console.log(
        "🚀 ~ chatReplyProcess ~ ErrorCodeMessage[code]",
        ErrorCodeMessage[code]
      );
  }
}

export type { ChatMessage };

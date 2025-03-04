import { failRes, MessageParamSchema } from "@/utils";
import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { insertMessage } from "./message";
import chatReplyProcess, { ChatMessage } from "@/lib/chatgpt";
import db from "@/db";
import log4js from "log4js";
import { history, messages } from "@/db/schema";
import { eq, count } from "drizzle-orm";

import ScenariosDict from "../../public/scenarios-dict.json" assert { type: "json" };

const logger = log4js.getLogger("chat");
logger.level = "all";

interface RequestSSE {
  content: string;
  historyId: string;
  model?: string;
  systemMessage?: string;
  doneCallback?: (fullResponse: any, usage: any) => void;
}

// // POST
// export async function chat(c: Context) {
//   const body = await c.req.json();
//   const { type } = MessageParamSchema.parse(body);

//   // if (type === "audio") {
//   //   return chatAudio(c);
//   // } else {
//   // }
//   return chatText(c);
// }

// POST
export async function chat(c: Context) {
  const body = await c.req.json();
  const { content, historyId, model, scenarioId } =
    MessageParamSchema.parse(body);

  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以继续" }));
  }

  // * Update History Title
  try {
    const msg = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.historyId, historyId));
    logger.debug("historyId===", msg, historyId);

    if (msg[0].count == 0) {
      await db
        .update(history)
        .set({ title: content.slice(0, 20) })
        .where(eq(history.id, historyId));
    }
  } catch (e) {
    logger.error("chatText error", e);
    return c.json({
      message: "chatText error",
    });
  }

  //* Add User Message
  await insertMessage(c, {
    content,
    historyId,
    userId: user.id,
    isAiRes: false,
  });

  const systemMessage = ScenariosDict[scenarioId];
  logger.debug("systemMessage", systemMessage);

  const doneCallback = async (fullResponse, usage) => {
    //* Add AI Message
    const messageId = await insertMessage(c, {
      userId: user.id,
      content: fullResponse.trimStart(),
      historyId,
      isAiRes: true,
      token: usage.total_tokens,
    });

    // usage: {
    //   prompt_tokens: 3,
    //   completion_tokens: 16,
    //   total_tokens: 19,
    //   estimated: true
    // }
    console.log("🚀 ~ add message ~ :", messageId);
    return messageId;
  };

  return sse(c, { content, historyId, model, systemMessage, doneCallback });
}

// POST
export async function chatAudio(c: Context) {
  const body = await c.req.json();
  const { content, historyId } = MessageParamSchema.parse(body);

  return sse(c, { content, historyId });
}

export async function sse(c: Context, params: RequestSSE) {
  const { content, historyId, model, systemMessage, doneCallback } = params;
  console.log("🚀 ~ start SSE ~ content ~ :", content, historyId, model);

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    const signal = controller.signal;

    stream.onAbort(async () => {
      console.log("🚨 ~ Client ABORT the connection !!! ~ ");
      controller.abort();
      await stream.writeSSE({
        event: "error",
        data: "Client ABORT the connection !!!",
      });
    });

    let firstChunk = true;
    let fullResponse = "";
    const chatReply = await chatReplyProcess({
      message: content,
      signal: signal,
      systemMessage: "",
      payload: {
        chatId: historyId,
        responseChatItemId: undefined,
        // messages: [{ role: "user", content: content }],
        detail: true,
        stream: true,
        variables: {
          max_tokens: "500",
          model: model,
          systemMessage: systemMessage,
          cTime: new Date().toLocaleString("zh-CN", {
            weekday: "long",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      },
      process: (chat: ChatMessage) => {
        fullResponse = chat.text;
        firstChunk = false;
        console.log("🚀 ~ chatReplyProcess ", chat.text);

        stream.writeSSE({
          data: JSON.stringify({
            event: "message",
            data: fullResponse,
          }),
        });
      },
    });

    const usage = chatReply.detail.usage;
    logger.debug("sse fullResponse", fullResponse, usage);

    const doneRes = await doneCallback?.(fullResponse, usage);
    await stream.writeSSE({
      data: JSON.stringify({
        event: "done",
        data: doneRes,
      }),
    });
  });
}

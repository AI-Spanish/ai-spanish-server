import { and, asc, count, desc, eq } from "drizzle-orm";
import { Context } from "hono";

import {
  failRes,
  listRes,
  MessageListParamSchema,
  MessageParamSchema,
  successRes,
} from "@/utils";
import db, { increment } from "@/db";
import { messages, users } from "@/db/schema";

// GET
export async function getMessageList(c: Context) {
  const { historyId, page, pageSize } = MessageListParamSchema.parse(
    c.req.query()
  );

  // const user = c.get('user');
  // if (!user) {
  //   return c.json(
  //     successRes({
  //       message: '登录以查看翻译历史记录',
  //     })
  //   );
  // }

  try {
    const totalCount = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.historyId, historyId));

    const historyList = await db.query.messages.findMany({
      where: eq(messages.historyId, historyId),
      orderBy: [asc(messages.createdAt)],
      // offset: (page - 1) * pageSize,
      // limit: pageSize,
    });

    return c.json(
      listRes({
        list: historyList,
        total: totalCount[0]?.count ?? 0,
        queryParams: {
          page,
          pageSize,
        },
      })
    );
  } catch (e: any) {
    console.log(e);

    return c.json(
      failRes({
        message: e.detail,
      })
    );
  }
}

export async function insertMessage(c: Context, params: any) {
  const payload = MessageParamSchema.parse(params);

  let newMes = {
    ...payload,
  };

  try {
    const messageId = await db
      .insert(messages)
      .values(newMes)
      .returning({ id: messages.id });

    // * record token
    if (payload.token) {
      await db
        .update(users)
        .set({
          recordToken: increment(users.recordToken, payload.token),
        })
        .where(eq(users.id, payload.userId));
    }

    console.log("💬 ~  Add Message Record  ", messageId?.[0]?.id, newMes);
    return messageId?.[0]?.id;
  } catch (e: any) {
    console.log(e);
    return;
  }
}

export async function updateMessage(c: Context, id: string, params: any) {
  // const payload = MessageParamSchema.parse(params);

  let updateData = {
    // uid: user.id,
    ...params,
  };
  // console.log('💬 ~ updateData===', updateData);

  try {
    await db.update(messages).set(updateData).where(eq(messages.id, id));
    console.log("💬 ~ Update Message Record  ", id, updateData);
    return;
  } catch (e: any) {
    console.log(e);
    return;
  }
}

//POST
export async function updateMessage2(c: Context) {
  const { messageId, content } = MessageParamSchema.parse(c.req.query());
  const siteConfig = c.get("site_config");
  const _targetText = siteConfig?.content ?? content;
  const _id = siteConfig?.id ?? messageId;

  try {
    const updateData: any = {};
    if (_targetText !== undefined) updateData.content = _targetText;

    if (Object.keys(updateData).length > 0) {
      await db.update(messages).set(updateData).where(eq(messages.id, _id));
    }
    console.log("🚨 ~  Update History Record ", _id);

    return;
  } catch (e: any) {
    console.log(e);

    return c.json(
      failRes({
        message: e.detail,
      })
    );
  }
}

//POST
export async function deleteMessage(c: Context) {
  const { messageId } = MessageParamSchema.parse(c.req.query());
  const user = c.get("user");

  if (!user) {
    return c.json(
      failRes({
        message: "请先登录",
      })
    );
  }

  try {
    await db.delete(messages).where(eq(messages.id, messageId));
    console.log("🚨 ~  Delete History Record ", messageId);

    return c.json(successRes({ message: "历史记录已删除" }));
  } catch (e: any) {
    console.log(e);

    return c.json(
      failRes({
        message: e.detail || "删除历史记录失败",
      })
    );
  }
}

//GET
export async function getAllMessages(c: Context) {
  const user = c.get("user");

  if (!user) {
    return c.json(
      failRes({
        message: "请先登录",
      })
    );
  }

  try {
    // 获取该用户的所有消息，并按创建时间排序（升序）
    const messagesList = await db
      .select()
      .from(messages)
      .where(eq(messages.uid, user.id))  // 仅获取当前用户的消息
      .orderBy(asc(messages.createdAt))  // 按创建时间升序排列
      .execute();

    if (!messagesList || messagesList.length === 0) {
      return c.json(
        failRes({
          message: "没有找到用户消息",
        })
      );
    }

    // 获取用户的剩余 token
    const userData = await db
      .select({"recordToken": users.recordToken})
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .execute();

    if (!userData || userData.length === 0) {
      return c.json(
        failRes({
          message: "用户数据未找到",
        })
      );
    }

    let userTokensRemaining = userData[0].recordToken; // 初始剩余 token
    const resultMessages = [];

    for (let i = 0; i < messagesList.length; i++) {
      const userMessage = messagesList[i];

      if (userMessage.isAiRes) continue;

      const aiMessage = messagesList[i + 1] && messagesList[i + 1].isAiRes ? messagesList[i + 1] : null;

      const userToken = userMessage.token || 0;
      const aiToken = aiMessage ? aiMessage.token || 0 : 0;
      const totalTokenConsumed = userToken + aiToken;

      userTokensRemaining -= totalTokenConsumed;

      resultMessages.push({
        questionId: userMessage.id,
        totalTokenConsumed, 
        userTokensRemaining, 
        userMessage, 
        aiMessage, 
      });

      if (aiMessage) i++;
    }

    return c.json(
      successRes({
        message: "获取用户消息成功",
        data: resultMessages,  
      })
    );
  } catch (e: any) {
    console.log(e);
    return c.json(
      failRes({
        message: e.detail || "获取消息失败",
      })
    );
  }
}
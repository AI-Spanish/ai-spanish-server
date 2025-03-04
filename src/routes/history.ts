import { count, desc, eq } from "drizzle-orm";
import { Context } from "hono";

import {
  ContextVariables,
  failRes,
  HistoryParamsSchema,
  listRes,
  PageQueryParamsSchema,
  serverEnvs,
  successRes,
} from "@/utils";
import db from "@/db";
import { history, messages } from "@/db/schema";

// GET
export async function getHistory(c: Context<{ Variables: ContextVariables }>) {
  const queryParams = PageQueryParamsSchema.parse(c.req.query());
  const { page, pageSize } = queryParams;

  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以查看历史记录" }));
  }

  try {
    const totalCount = await db
      .select({ count: count(history.id) })
      .from(history)
      .where(eq(history.uid, user.id));

    const historyList = await db.query.history.findMany({
      where: eq(history.uid, user.id),
      orderBy: [desc(history.createdAt)],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return c.json(
      listRes({
        queryParams,
        list: historyList,
        total: totalCount[0]?.count ?? 0,
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

//POST
export async function insertHistory(c: Context) {
  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以查看历史记录" }));
  }

  try {
    const historyId = await db
      .insert(history)
      .values({
        uid: user.id,
      })
      .returning({ id: history.id });

    console.log("🚨 ~  Add History Record  ", historyId?.[0]?.id);

    return c.json(
      successRes({
        id: historyId?.[0]?.id,
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

//POST
export async function deleteHistory(c: Context) {
  const body = await c.req.json();
  const { id } = HistoryParamsSchema.parse(body);
  console.log("🚨 ~  Delete History Record ", id);

  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "请先登录" }));
  }

  try {
    await db.delete(messages).where(eq(messages.historyId, id));
    await db.delete(history).where(eq(history.id, id));

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

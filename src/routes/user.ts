import { Context } from "hono";
import db from "@/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { cardKey, session, studyDuration, users, word } from "@/db/schema";
import {
  ContextVariables,
  failRes,
  listRes,
  serverEnvs,
  successRes,
  UserParamsSchema,
  generateRandomNickname,
  RechargeCardKeySchema,
} from "@/utils";
import axios from "axios";
import { getCookie, setCookie } from "hono/cookie";
import { lucia } from "@/auth";
import log4js from "log4js";

const logger = log4js.getLogger("user");
logger.level = "all";

export const InitOFMatrix = {
  "1.3": [5],
  "1.4": [5],
  "1.5": [5],
  "1.6": [5],
  "1.7": [5],
  "1.8": [5],
  "1.9": [5],
  "2.0": [5],
  "2.1": [5],
  "2.2": [5],
  "2.3": [5],
  "2.4": [5],
  "2.5": [5],
  "2.6": [5],
  "2.7": [5],
  "2.8": [5],
};

const InitWordSetting = {
  groupSize: 10,
  dailyLearn: 1,
  dailyReview: 1,
  autoplay: false,

  learn_repeat_t: 3,
  learn_first_m: "chooseTrans",
  learn_second_m: "recallTrans",
  learn_third_m: "recallWord",
  learn_fourth_m: "recallTrans",

  review_repeat_t: 2,
  review_first_m: "chooseTrans",
  review_second_m: "recallWord",
  review_third_m: "recallTrans",
};

// GET
export async function info(c: Context<{ Variables: ContextVariables }>) {
  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "用户登录失效" }));
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  console.log("info===", existingUser);

  return c.json(
    successRes({
      message: "用户验证成功",
      ...existingUser,
      wordSetting: JSON.parse(existingUser.wordSetting),
    })
  );
}

// POST
export async function login(c: Context<{ Variables: ContextVariables }>) {
  const body = await c.req.json();
  const { type, code, wxCode, nickName, avatarUrl, username, pwd } =
    UserParamsSchema.parse(body);

  let curUser = null;
  let openid = null;

  if (type === "wechat") {
    const { data: openidData } = await axios.get(
      "https://api.weixin.qq.com/sns/jscode2session",
      {
        params: {
          appid: serverEnvs.WX_APPID,
          secret: serverEnvs.WX_SECRET,
          js_code: wxCode,
          grant_type: "authorization_code",
        },
      }
    );
    openid = openidData.openid;

    const { data: access } = await axios.get(
      "https://api.weixin.qq.com/cgi-bin/token",
      {
        params: {
          appid: serverEnvs.WX_APPID,
          secret: serverEnvs.WX_SECRET,
          grant_type: "client_credential",
        },
      }
    );
    const { data } = await axios.post(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${access.access_token}`,
      {
        code: code,
      }
    );
    const phoneNumber = data.phone_info.phoneNumber;
    try {
      curUser = await db.query.users.findFirst({
        where: eq(users.id, phoneNumber),
      });

      // logger.debug("curUser", phoneNumber, curUser);

      // 注册
      if (!curUser) {
        curUser = {
          id: phoneNumber,
          username: phoneNumber,
          phoneNumber: phoneNumber,
          nickName: nickName || `西语#${generateRandomNickname(12)}`,
          avatarUrl,
          of_matrix: JSON.stringify(InitOFMatrix),
          wordSetting: JSON.stringify(InitWordSetting),
        };
        await db.insert(users).values(curUser);
      }
    } catch (e: any) {
      logger.debug("error", e);
      return c.json(
        failRes({
          message: e.detail,
        })
      );
    }
  }
  // 用户名密码登录
  else if (type == "login") {
    try {
      curUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!curUser) {
        return c.json(
          failRes({
            message: "账号或密码错误",
          })
        );
      } else if (curUser.pwd !== pwd) {
        return c.json(
          failRes({
            message: "账号或密码错误",
          })
        );
      }
    } catch (e: any) {
      logger.debug("error", e);
      return c.json(
        failRes({
          message: e.detail,
        })
      );
    }
  } else if (type == "register") {
    try {
      curUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });
      if (curUser) {
        return c.json(
          failRes({
            code: 401,
            message: "该账号已被注册",
          })
        );
      }

      curUser = {
        username,
        pwd,
        nickName: username,
        avatarUrl:
          "https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132",
        of_matrix: JSON.stringify(InitOFMatrix),
        wordSetting: JSON.stringify(InitWordSetting),
      };
      const userId = await db
        .insert(users)
        .values(curUser)
        .returning({ id: users.id });

      curUser.id = userId[0].id;
    } catch (e: any) {
      logger.debug("error", e);
      return c.json(
        failRes({
          message: e.detail,
        })
      );
    }
  }

  const session = await lucia.createSession(curUser.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  setCookie(c, lucia.sessionCookieName, sessionCookie.value);

  return c.json(
    successRes({
      ...curUser,
      openid: openid,
      wordSetting: JSON.parse(curUser.wordSetting),
    })
  );
}

// GET
export async function logout(c: Context<{ Variables: ContextVariables }>) {
  const session = c.get("session");
  if (session) {
    await lucia.invalidateSession(session.id);
    c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize());
  }
  return c.json(successRes({}));
}

// POST
export async function updateUser(c: Context) {
  const { wordSetting, nickName, avatarUrl, gender } = await c.req.json();

  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以继续" }));
  }

  const newUser = {
    wordSetting: wordSetting ? JSON.stringify(wordSetting) : undefined,
    nickName: nickName ? nickName : undefined,
    avatarUrl: avatarUrl ? avatarUrl : undefined,
    gender: gender ? gender : undefined,
  };

  try {
    // console.log("updateUser===", wordSetting, JSON.stringify(wordSetting));

    const res = await db
      .update(users)
      .set(newUser)
      .where(eq(users.id, user.id))
      .returning({ wordSetting: users.wordSetting });
    const data = JSON.parse(res[0].wordSetting);

    return c.json(successRes(data));
  } catch (e: any) {
    logger.error("updateUser", e);
    return c.json(
      failRes({
        message: e.detail,
      })
    );
  }
}

// POST
export async function updateStudyDuration(c: Context) {
  const body = await c.req.json();
  const { userId, duration, id } = body;

  if (!userId || !duration) {
    return c.json(failRes({ message: "缺少必要的参数" }));
  }

  // console.log("学习时长记录===", id, duration);

  try {
    if (id) {
      await db
        .update(studyDuration)
        .set({ duration: Math.floor(duration / 60) })
        .where(eq(studyDuration.id, id));

      return c.json(successRes({ id: id, message: "学习时长记录更新成功" }));
    } else {
      const studyId = await db
        .insert(studyDuration)
        .values({
          userId,
          duration: Math.floor(duration / 60),
        })
        .returning({ id: studyDuration.id });

      return c.json(
        successRes({ id: studyId?.[0]?.id, message: "学习时长记录创建成功" })
      );
    }
  } catch (e: any) {
    return c.json(failRes({ message: e.message }));
  }
}

// GET
export async function getStudyDuration(c: Context) {
  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "用户验证失败" }));
  }

  try {
    const durations = await db
      .select()
      .from(studyDuration)
      .where(eq(studyDuration.userId, user.id))
      .orderBy(asc(studyDuration.createdAt));

    const groupedDurations = durations.reduce((acc: any, cur: any) => {
      const date = cur.createdAt.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = { date, duration: 0 };
      }
      acc[date].duration += cur.duration;
      return acc;
    }, {});

    const result = Object.values(groupedDurations);
    const x = result.map((item: any) => item.date);
    const y = result.map((item: any) => item.duration);
    console.log("getStudyDuration===", result);

    return c.json(successRes({ x, y }));
  } catch (e: any) {
    return c.json(failRes({ message: e.message }));
  }
}

//GET
export async function getAllUsersInfo(
  c: Context<{ Variables: ContextVariables }>
) {
  // const user = c.get("user");
  // if (!user) {
  //   return c.json(failRes({ code: 401, message: "用户登录失效" }));
  // }

  // const currentUser = await db.query.users.findFirst({
  //   where: eq(users.id, user.id),
  // });

  const allUsers = await db.select().from(users);
  const formattedUsers = allUsers.map((user) => ({
    ...user,
    wordSetting: JSON.parse(user.wordSetting),
  }));

  return c.json(
    successRes({
      message: "所有用户信息",
      users: formattedUsers,
    })
  );
}

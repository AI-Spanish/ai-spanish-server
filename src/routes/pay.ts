import { Context } from "hono";
import db from "@/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { cardKey, orders, studyDuration, users, word } from "@/db/schema";
import {
  ContextVariables,
  serverEnvs,
  failRes,
  successRes,
  RechargeCardKeySchema,
  generateNonceStr,
  PrepayInfoSchema,
} from "@/utils";
import axios from "axios";
import log4js from "log4js";
import fs from "fs";
import crypto from "crypto";
import path from "path";

const logger = log4js.getLogger("user");
logger.level = "all";

const certPath = path.join(process.cwd(), "env/cert/apiclient_key.pem");
/**
 * 微信支付v3 下单签名值生成
 * @param {string} method 请求方法
 * @param {string} url  微信小程序下单官方api
 * @param {number} timestamp 时间戳 秒级
 * @param {string} nonce_str 随机字符串
 * @param {Object} order 主体（订单）信息
 */
function createOrderSign(method, url, timestamp, nonce_str, order) {
  // 签名串
  let signStr = `${method}\n${url}\n${timestamp}\n${nonce_str}\n${JSON.stringify(
    order
  )}\n`;
  // 读取API证书文件内容 apiclient_key.pem的内容
  let cert = fs.readFileSync(certPath, "utf-8");
  // 创建使用 RSA 算法和 SHA-256 散列算法的签名对象
  let sign = crypto.createSign("RSA-SHA256");
  // 对签名串进行加密处理
  sign.update(signStr);
  return sign.sign(cert, "base64");
}

/**
 * 微信支付v3 付款签名生成支付参数
 * @param {string} prepay_id 预支付交易会话标识
 */
async function createPaySign(prepay_id: string) {
  let timeStamp = Math.floor(new Date().getTime() / 1000).toString();
  let nonceStr = generateNonceStr(32);
  let signStr = `${serverEnvs.WX_APPID}\n${timeStamp}\n${nonceStr}\nprepay_id=${prepay_id}\n`;
  let cert = fs.readFileSync(certPath, "utf-8");
  let sign = crypto.createSign("RSA-SHA256");
  sign.update(signStr);
  return {
    paySign: sign.sign(cert, "base64"),
    timeStamp: timeStamp,
    nonceStr: nonceStr,
    signType: "RSA",
    package: "prepay_id=" + prepay_id,
  };
}

/**
 * 微信支付v3 解密支付结果
 * @param {string} prepay_id 预支付交易会话标识
 */
async function decodePayNotify(resource) {
  try {
    const AUTH_KEY_LENGTH = 16;
    // ciphertext = 密文，associated_data = 填充内容， nonce = 位移
    const { ciphertext, associated_data, nonce } = resource;
    // 密钥
    const key_bytes = Buffer.from(serverEnvs.WX_APIV3_KEY, "utf8");
    // 位移
    const nonce_bytes = Buffer.from(nonce, "utf8");
    // 填充内容
    const associated_data_bytes = Buffer.from(associated_data, "utf8");
    // 密文Buffer
    const ciphertext_bytes = Buffer.from(ciphertext, "base64");
    // 计算减去16位长度
    const cipherdata_length = ciphertext_bytes.length - AUTH_KEY_LENGTH;
    // upodata
    const cipherdata_bytes = ciphertext_bytes.slice(0, cipherdata_length);
    // tag
    const auth_tag_bytes = ciphertext_bytes.slice(
      cipherdata_length,
      ciphertext_bytes.length
    );
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key_bytes as any,
      nonce_bytes as any
    );
    decipher.setAuthTag(auth_tag_bytes as any);
    decipher.setAAD(associated_data_bytes as any);
    const output = Buffer.concat([
      decipher.update(cipherdata_bytes as any),
      decipher.final() as any,
    ]);
    // 解密后 转成 JSON 格式输出
    return JSON.parse(output.toString("utf8"));
  } catch (error) {
    console.error("解密错误:", error);
    return null;
  }
}

// POST
export async function rechargeWithCardKey(c: Context) {
  const body = await c.req.json();
  const { cardKey: cardKeyValue } = RechargeCardKeySchema.parse(body);

  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以继续" }));
  }

  try {
    // 使用事务处理卡密验证和充值
    const result = await db.transaction(async (tx) => {
      // 1. 查找卡密
      const cardRows = await tx
        .select()
        .from(cardKey)
        .where(eq(cardKey.id, cardKeyValue))
        .limit(1);

      if (cardRows.length === 0) {
        throw new Error("卡密不存在");
      }

      const cardData = cardRows[0] as any;

      if (cardData.is_used) {
        throw new Error("卡密已被使用");
      }

      if (cardData.expire_time && new Date(cardData.expire_time) < new Date()) {
        throw new Error("卡密已过期");
      }

      // 2. 更新卡密状态
      await tx
        .update(cardKey)
        .set({
          is_used: true,
          user_id: user.id,
          used_time: new Date(),
        })
        .where(eq(cardKey.id, cardData.id));

      // 3. 更新用户余额
      const userData = await tx
        .select({
          id: users.id,
          money: users.money,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (userData.length === 0) {
        throw new Error("用户不存在");
      }

      const currentBalance = userData[0].money || 0;
      const cardAmount = parseInt(cardData.amount) || 0;
      const newBalance = currentBalance + cardAmount;

      await tx
        .update(users)
        .set({ money: newBalance })
        .where(eq(users.id, user.id));

      return {
        success: true,
        newBalance,
        cardAmount,
        cardKey: cardData.id,
      };
    });

    logger.info(
      `用户 ${user.id} 使用卡密 ${cardKeyValue} 充值成功，金额: ${result.cardAmount}`
    );

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    return c.json(
      successRes({
        message: "充值成功",
        ...existingUser,
      })
    );
  } catch (error) {
    logger.error("卡密充值失败", error);

    if (error instanceof Error) {
      return c.json(
        failRes({
          code: 500,
          message: error.message,
        })
      );
    }

    return c.json(
      failRes({
        code: 500,
        message: "充值失败，请稍后重试",
      })
    );
  }
}

// POST
export async function generateCardKey(c: Context) {
  const body = await c.req.json();
  const { amount, expireTime = 7 } = body;

  if (!amount || amount <= 0) {
    return c.json(failRes({ code: 400, message: "充值金额必须大于0" }));
  }

  try {
    const cardData = {
      amount: amount.toString(),
      is_used: false,
      expire_time: new Date(
        new Date().getTime() + expireTime * 24 * 60 * 60 * 1000
      ),
      created_time: new Date(),
    };

    const cardId = await db
      .insert(cardKey)
      .values(cardData)
      .returning({ id: cardKey.id });

    logger.info(`生成了卡密 ${cardId}，金额: ${amount}`);

    return c.json(
      successRes({
        code: 200,
        message: "卡密生成成功",
        data: {
          cardId: cardId,
          amount: amount,
        },
      })
    );
  } catch (error) {
    logger.error("卡密生成失败", error);

    return c.json(
      failRes({
        code: 500,
        message: "卡密生成失败，请稍后重试",
      })
    );
  }
}

// GET
export async function getPrepayInfo(c: Context) {
  const user = c.get("user");
  if (!user) {
    return c.json(failRes({ code: 401, message: "登录以查看历史记录" }));
  }

  const { vipType, amount, openid } = PrepayInfoSchema.parse(c.req.query());

  const orderInfos = await db
    .insert(orders)
    .values({
      user_id: user.id,
      vipType: vipType,
      amount: amount * 100,
      status: 0,
    })
    .returning({ id: orders.id, amount: orders.amount });
  const orderInfo = orderInfos[0];

  let timestamp = Math.floor(new Date().getTime() / 1000);
  let nonce_str = generateNonceStr(32);

  let wxOrderInfo = {
    mchid: serverEnvs.WX_MCH_ID,
    appid: serverEnvs.WX_APPID,
    notify_url: serverEnvs.DOMAIN + "/api/pay/paymentSuccess", // 回调地址 自行实现接收支付结果信息
    out_trade_no: orderInfo.id, // 上面创建的订单的订单号
    description: vipType, // 商品描述
    amount: {
      total: orderInfo.amount, // 单位为分
      currency: "CNY",
    },
    payer: {
      openid: openid, // 用户的openid
    },
  };

  logger.debug("wxOrderInfo=", wxOrderInfo);
  //  计算签名值
  const signature = createOrderSign(
    "POST",
    "/v3/pay/transactions/jsapi",
    timestamp,
    nonce_str,
    wxOrderInfo
  );

  // 设置HTTP头
  let Authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${serverEnvs.WX_MCH_ID}",nonce_str="${nonce_str}",timestamp="${timestamp}",signature="${signature}",serial_no="${serverEnvs.WX_SERIAL_NO}"`;

  // 拿到 "prepay_id": "wx26112221580621e9b071c00d9e993b00666"
  const { data } = await axios.post(
    "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi",
    wxOrderInfo,
    {
      headers: { Authorization: Authorization },
    }
  );
  logger.debug("res=", data);
  const paySign = await createPaySign(data.prepay_id);
  return c.json(successRes(paySign));
}

// POST
export async function payNotify(c: Context) {
  const headers = c.req.header();
  const body = await c.req.json();

  // 解密微信支付成功后的订单信息
  const deInfo = await decodePayNotify(body.resource);
  logger.debug("deInfo=", deInfo);
  if (!deInfo) {
    console.log("支付回调解析失败", deInfo);
    logger.error(`支付回调解析失败: ${JSON.stringify(deInfo)}`);
    return c.json(failRes({ code: 500, message: "支付回调解析失败" }));
  }

  return c.json(successRes({ code: "SUCCESS", message: "成功" }));
}

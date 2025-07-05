import jwt from "jsonwebtoken";
import { serverEnvs } from "@/utils";
import { getCookie } from "hono/cookie";

const JWT_SECRET = serverEnvs.JWT_SECRET || "";
const JWT_EXPIRES_IN = "7d"; // Token 有效期7天

export const JWT_KEY = "auth_session";

export interface JWTPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

/**
 * 生成 JWT Token
 */
export function generateToken(
  payload: Omit<JWTPayload, "iat" | "exp">
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error("[401] Token verification failed");
    return null;
  }
}

/**
 * 从 Authorization header 中提取 token
 */
export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 解码令牌（不验证）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function jwtAuth(c, next) {
  const token = getCookie(c, JWT_KEY);

  const isWhitelisted = [
    "/public/*",
    "/api/user/login",
    "/api/user/updateStudyDuration",
  ].includes(c.req.path);
  if (isWhitelisted) {
    return next();
  }

  if (!token) {
    return c.json(
      {
        success: false,
        code: 401,
        message: "请先登录",
      },
      401
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return c.json(
      {
        success: false,
        code: 401,
        message: "登录已过期，请重新登录",
      },
      401
    );
  }

  const tokenPayload = decodeToken(token);
  c.set("user", {
    id: tokenPayload.userId,
  });
  return next();
}

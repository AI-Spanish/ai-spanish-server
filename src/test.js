import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 根目录路径
const url = fileURLToPath(import.meta.url);
const __dirname = path.dirname(url);
const rootDir = path.join(__dirname, "routes");

// 递归遍历目录下的所有文件
function getFiles(dir) {
  let files = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else if (fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  });
  return files;
}

// 模板文件内容
const template = `
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { ContextVariables } from "./utils";
import { lucia } from "./auth";
---import语句---

import log4js from "log4js";
import log4jsConfig from "./config/log4js.json" assert { type: "json" };
log4js.configure(log4jsConfig);

const app = new Hono<{ Variables: ContextVariables }>();

app.use("/public/*", serveStatic({ root: "./" }));

app.use("*", async (c, next) => {
  const sessionId = getCookie(c, lucia.sessionCookieName);

  if (!sessionId) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(c, lucia.sessionCookieName, sessionCookie.serialize(), {
      ...sessionCookie.attributes,
      sameSite: "Strict",
    });
  }

  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(c, lucia.sessionCookieName, sessionCookie.serialize(), {
      ...sessionCookie.attributes,
      sameSite: "Strict",
    });
  }

  c.set("session", session);
  c.set("user", user);
  return next();
});

app.get("/", (c) => c.text("Hello Node.js!"));

---接口生成---

console.log("Server is running on port 8000");
serve({
  fetch: app.fetch,
  port: 8000,
});
`;

// 获取所有控制器文件
const controllerFiles = getFiles(rootDir);

// 存储所有的 import 语句和路由代码
const importStatements = [];
const routeCodes = [];

const apiUrls = {};

// 读取每个控制器文件并生成相应的代码
controllerFiles.forEach((filePath) => {
  const relativePath = path.relative(__dirname, filePath);
  const relativePathWithoutExt = relativePath.replace(/\.ts$/, "");
  const importName = relativePathWithoutExt
    .replace(/^routes\//, "") // 去掉前缀
    .replace(/\/?index$/, "") // 去掉后缀index
    .replace(/\//g, "_"); // 替换路径分隔符为下划线
  const importPath =
    "./" +
    path
      .relative(path.dirname(path.join(__dirname, "index.ts")), filePath)
      .replace(/\\/g, "/")
      .replace(".ts", "");

  // 生成 import 语句
  const importStatement = `import * as ${importName} from '${importPath}';`;
  importStatements.push(importStatement);

  // 读取文件内容
  const data = fs.readFileSync(filePath, "utf8");

  // 正则表达式匹配方法和注释
  const pattern =
    /\/\/\s*(GET|POST)\s*export async function (\w+)\(c: Context.*\) \{/g;
  let match;

  while ((match = pattern.exec(data)) !== null) {
    const method = match[1];
    const functionName = match[2];
    let apiPath = relativePathWithoutExt
      .replace(/^routes/, "")
      .replace(/\/index/, ""); // 将路径前缀改为 /api
    const route = `app.${method.toLowerCase()}("/api${apiPath}/${functionName}", ${importName}.${functionName});`;
    routeCodes.push(route);

    // 将API路径添加到apiUrls对象中
    const apiUrl = `/api${apiPath}/${functionName}`;
    apiUrls[`API_${importName.toUpperCase()}_${functionName.toUpperCase()}`] =
      apiUrl;
  }
});

// 将生成的内容插入模板的相应位置
const finalOutput = template
  .replace("---import语句---", importStatements.join("\n"))
  .replace("---接口生成---", routeCodes.join("\n"));

// 将生成的内容插入模板的相应位置，并添加apiUrls的导出语句
const apiUrlsOutput = `export const API_URLS = ${JSON.stringify(
  apiUrls,
  null,
  2
)};`;

// 输出生成的最终代码
// console.log(finalOutput);

// 将生成的最终代码写入文件
fs.writeFile(path.join(__dirname, "index.ts"), finalOutput, (err) => {
  if (err) {
    console.error("写入文件失败:", err);
    return;
  }
  console.log("文件生成成功: index.ts");
});

// 将生成的最终代码写入文件
fs.writeFile(path.join(__dirname, "constants.ts"), apiUrlsOutput, (err) => {
  if (err) {
    console.error("写入文件失败:", err);
    return;
  }
  console.log("文件生成成功: constants.ts");
});

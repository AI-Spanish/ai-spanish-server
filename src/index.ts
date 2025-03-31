
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { ContextVariables } from "./utils";
import { lucia } from "./auth";
import * as audio from './routes/audio';
import * as chat from './routes/chat';
import * as history from './routes/history';
import * as message from './routes/message';
import * as scenario from './routes/scenario';
import * as user from './routes/user';
import * as word from './routes/word';

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

app.post("/api/audio/text2audio", audio.text2audio);
app.post("/api/audio/audio2text", audio.audio2text);
app.get("/api/audio/getOssUrl", audio.getOssUrl);
app.post("/api/audio/text2oss", audio.text2oss);
app.post("/api/audio/iat_xunfei", audio.iat_xunfei);
app.post("/api/audio/tts_xunfei", audio.tts_xunfei);
app.post("/api/audio/tts_youdao", audio.tts_youdao);
app.get("/api/audio/testOSS", audio.testOSS);
app.post("/api/chat/chat", chat.chat);
app.post("/api/chat/chatAudio", chat.chatAudio);
app.get("/api/history/getHistory", history.getHistory);
app.post("/api/history/insertHistory", history.insertHistory);
app.post("/api/history/deleteHistory", history.deleteHistory);
app.get("/api/message/getMessageList", message.getMessageList);
app.post("/api/message/updateMessage2", message.updateMessage2);
app.post("/api/message/deleteMessage", message.deleteMessage);
app.get("/api/message/getAllMessages", message.getAllMessages);
app.get("/api/scenario/getScenarioList", scenario.getScenarioList);
app.get("/api/user/info", user.info);
app.post("/api/user/login", user.login);
app.get("/api/user/logout", user.logout);
app.post("/api/user/updateUser", user.updateUser);
app.post("/api/user/updateStudyDuration", user.updateStudyDuration);
app.get("/api/user/getStudyDuration", user.getStudyDuration);
app.get("/api/user/getAllUsersInfo", user.getAllUsersInfo);
app.post("/api/word/changeWordBook", word.changeWordBook);
app.get("/api/word/getWordDetail", word.getWordDetail);
app.get("/api/word/getAllWBData", word.getAllWBData);
app.get("/api/word/getWBSections", word.getWBSections);
app.get("/api/word/getSingleWBData", word.getSingleWBData);
app.get("/api/word/getWBLearnData", word.getWBLearnData);
app.get("/api/word/getAllLearnData", word.getAllLearnData);
app.get("/api/word/getTodayLearnData", word.getTodayLearnData);
app.get("/api/word/getBasicLearningData", word.getBasicLearningData);
app.get("/api/word/getLearningData", word.getLearningData);
app.get("/api/word/getReviewData", word.getReviewData);
app.get("/api/word/getBookRecordWord", word.getBookRecordWord);
app.get("/api/word/getUserRecordWord", word.getUserRecordWord);
app.get("/api/word/getDailySum", word.getDailySum);
app.post("/api/word/addLearningRecord", word.addLearningRecord);
app.post("/api/word/updateLearningRecord", word.updateLearningRecord);
app.get("/api/word/getNoteBookWord", word.getNoteBookWord);
app.post("/api/word/toggleAddToNB", word.toggleAddToNB);

console.log("Server is running on port 8000");
serve({
  fetch: app.fetch,
  port: 8000,
});

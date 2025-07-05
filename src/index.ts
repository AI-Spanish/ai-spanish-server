import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ContextVariables } from "./utils";
import { jwtAuth } from "./lib/jwt";
import * as audio from "./routes/audio";
import * as chat from "./routes/chat";
import * as history from "./routes/history";
import * as message from "./routes/message";
import * as pay from "./routes/pay";
import * as scenario from "./routes/scenario";
import * as user from "./routes/user";
import * as word from "./routes/word";

import log4js from "log4js";
import log4jsConfig from "./config/log4js.json" assert { type: "json" };
log4js.configure(log4jsConfig);

const app = new Hono<{ Variables: ContextVariables }>();

app.use("/public/*", serveStatic({ root: "./" }));

app.use("*", jwtAuth);

app.get("/", (c) => c.text("Hello Node.js!"));

app.post("/api/audio/text2audio", audio.text2audio);
app.post("/api/audio/audio2text", audio.audio2text);
app.get("/api/audio/getOssUrl", audio.getOssUrl);
app.post("/api/audio/text2oss", audio.text2oss);
app.post("/api/audio/iat_xunfei", audio.iat_xunfei);
app.post("/api/audio/tts_xunfei", audio.tts_xunfei);
app.post("/api/audio/tts_youdao", audio.tts_youdao);
app.get("/api/audio/testOSS", audio.testOSS);
app.get("/api/chat/chatCheck", chat.chatCheck);
app.post("/api/chat/chat", chat.chat);
app.post("/api/chat/chatAudio", chat.chatAudio);
app.get("/api/history/getHistory", history.getHistory);
app.post("/api/history/insertHistory", history.insertHistory);
app.post("/api/history/deleteHistory", history.deleteHistory);
app.get("/api/message/getMessageList", message.getMessageList);
app.post("/api/message/updateMessage2", message.updateMessage2);
app.post("/api/message/deleteMessage", message.deleteMessage);
app.get("/api/message/getAllMessages", message.getAllMessages);
app.post("/api/pay/rechargeWithCardKey", pay.rechargeWithCardKey);
app.post("/api/pay/generateCardKey", pay.generateCardKey);
app.get("/api/pay/getPrepayInfo", pay.getPrepayInfo);
app.post("/api/pay/paySuccess", pay.paySuccess);
app.post("/api/pay/payNotify", pay.payNotify);
app.get("/api/scenario/getScenarioList", scenario.getScenarioList);
app.get("/api/user/info", user.info);
app.post("/api/user/login", user.login);
app.get("/api/user/logout", user.logout);
app.post("/api/user/updateUser", user.updateUser);
app.post("/api/user/updateStudyDuration", user.updateStudyDuration);
app.get("/api/user/getStudyDuration", user.getStudyDuration);
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

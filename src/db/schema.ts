import { SQL, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username"),
  pwd: text("pwd"),
  nickName: text("nickName"),
  gender: integer("gender"),
  phoneNumber: text("phoneNumber"),
  avatarUrl: text("avatarUrl"),
  of_matrix: text("of_matrix"),
  l_book_id: text("l_book_id")
    .references(() => wordBook.id)
    .default("-1"),
  wordSetting: text("word_setting"),
  money: integer("money").default(0),
  recordToken: integer("record_token").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(
    () => new Date()
  ),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const history = pgTable("history", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").default("New Chat"),
  uid: text("user_id"),
  partner: text("partner"),
  // .notNull()
  // .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(
    () => new Date()
  ),
});

export const messages = pgTable("messages", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  historyId: text("history_id").references(() => history.id),
  uid: text("user_id"),
  content: text("content"),
  isAiRes: boolean("is_ai_res"), // true:AI false: user
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(
    () => new Date()
  ),
  qs_limit: integer("qs_limit"),
  token: integer("token"),
  seconds: text("seconds"),
  filename: text("filename"),
});

export const studyDuration = pgTable("study_duration", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  duration: integer("duration").notNull(), // duration in minutes
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(
    () => new Date()
  ),
});

export const wordBook = pgTable("word_book", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tag: text("tag"),
  name: text("name"),
  total: integer("total"),
  description: text("description"),
  cover: text("cover"),
  parBookId: text("parBookId"),
});

export const word = pgTable("word", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pos: text("pos"),
  word: text("word"),
  definition: text("definition"),
  translation: text("translation"),
  phonetic: text("phonetic"),
  voiceUrl: text("voice_url"),
});

export const wordInBook = pgTable("word_in_book", {
  id: text("id")
    .notNull()
    .primaryKey()
    .generatedAlwaysAs(
      (): SQL => sql`${wordInBook.wb_id} || '_' || ${wordInBook.word_id}`
    ),
  wb_id: text("wb_id").references(() => wordBook.id),
  word_id: text("word_id").references(() => word.id),
  section_id: text("section_id"),
  word_index: integer("word_index"),
});

// 存放学习单词记录，学习单词后会生成，记录单词的学习时间，学习次数，遗忘相关参数等
export const learningRecord = pgTable("learning_record", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  word: text("word"),
  word_id: text("word_id").references(() => word.id),
  user_id: text("user_id").references(() => users.id),
  master: boolean("master").default(false),
  last_l: date("last_l", { mode: "date" }), // 上一次 学习时间
  next_l: date("next_l", { mode: "date" }), // 下一次 学习时间
  // c_time: date("c_time", { mode: "date" }), // 学习时间
  last_r: date("last_r", { mode: "date" }), // 上一次 复习时间
  NOI: integer("NOI"),
  EF: text("EF"),
  next_n: integer("next_n"),
  createdAt: date("created_at", { mode: "date" }).defaultNow().notNull(),
});

// 存放临时学习数据，设置的学习机制是，比如一组10个，会获取15个，学习的时候可能这15个都会碰到，但只要满10个就认为学完一组，则这多出来的5个的重复次数会记录到本数据库中，下次获取的时候一并获取从而保留之前的重复次数
// export const learningRecordTmp = pgTable("learning_record_temp", {
//   id: text("id")
//     .notNull()
//     .primaryKey()
//     .default(sql`gen_random_uuid()`),
//   user_id: text("user_id").references(() => users.id),
//   word: text("word"),
//   word_id: text("word_id").references(() => word.id),
//   repeatTimes: integer("repeatTimes"),
//   learn_time: date("learn_time", { mode: "date" }),
// });

// 用户每日学习数据
export const dailySum = pgTable("daily_sum", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: text("user_id").references(() => users.id),
  learn: integer("learn"), // 学习单词数
  review: integer("review"), // 复习单词数
  createdAt: date("created_at", { mode: "date" }).defaultNow().notNull(),
});

// 生词本，在学习或者查词过程中可以点击“星星”将单词加入生词本，就会在本数据库生成相关数据
export const notebook = pgTable("notebook", {
  id: text("id")
    .notNull()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => users.id),
  word_id: text("word_id").references(() => word.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

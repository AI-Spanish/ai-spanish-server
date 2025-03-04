import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnvs } from "@/utils";
import * as schema from "@/db/schema";
import { AnyColumn, sql } from "drizzle-orm";

declare global {
  var globalDb: PostgresJsDatabase<typeof schema> | undefined;
}

let db: PostgresJsDatabase<typeof schema>;

console.log("=== [DATABASE_URL] ", serverEnvs.DATABASE_URL);

if (serverEnvs.NODE_ENV === "production") {
  db = drizzle(postgres(serverEnvs.DATABASE_URL, { prepare: true }), {
    schema,
  });
} else {
  if (!global.globalDb)
    global.globalDb = drizzle(
      postgres(serverEnvs.DATABASE_URL, { prepare: true }),
      { schema }
    );

  db = global.globalDb;
}

export const increment = (column: AnyColumn, value = 1) => {
  return sql`${column} + ${value}`;
};

export default db;

import { type Config } from "drizzle-kit";
import dotenv from "dotenv";

let dbURL;
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.prod" });
  dbURL = process.env.DATABASE_URL?.replace(
    "host.docker.internal",
    "localhost"
  );
} else {
  dotenv.config({ path: ".env.dev" });
  dbURL = process.env.DATABASE_URL;
}
console.log("===[dbURL]", dbURL);

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/out",
  dialect: "postgresql",
  dbCredentials: {
    url: dbURL!,
  },
} satisfies Config;

import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia, TimeSpan } from "lucia";

import db from "./db";
import { session, users } from "./db/schema";
import { serverEnvs } from "./utils";

const adapter = new DrizzlePostgreSQLAdapter(db, session, users);

export const lucia = new Lucia(adapter, {
  // sessionExpiresIn: new TimeSpan(1, "w"), // Session lifetime 2 weeks
  sessionCookie: {
    expires: true,
    attributes: {
      secure: serverEnvs.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      name: attributes.name,
      avatar: attributes.avatar,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: string;
      name: string;
      avatar: string;
    };
  }
}

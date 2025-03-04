import { and, count, desc, eq } from "drizzle-orm";
import { Context } from "hono";

import { failRes, listRes, PageQueryParamsSchema, successRes } from "@/utils";
import ScenariosList from "../../public/scenarios.json" assert { type: "json" };

// GET
export async function getScenarioList(c: Context) {
  const queryParams = PageQueryParamsSchema.parse(c.req.query());
  const { page, pageSize } = queryParams;

  return ScenariosList
    ? c.json(
        listRes({
          queryParams,
          list: ScenariosList,
        })
      )
    : c.json(
        failRes({
          message: "No scenarios found",
        })
      );
}

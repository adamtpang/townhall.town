// AI SDK tools for the two plug-ins. Spread into the agent's tools:
//   tools: { ...existingTools, ...civicTools }
import { tool } from "ai";
import { z } from "zod";
import { getAccountability, keptRate } from "./accountability";
import { getTurnout } from "./turnout";

export const civicTools = {
  getTurnout: tool({
    description:
      "Official turnout for a ZIP's county: ballots cast, registered voters, eligible people who did not vote, how much one ballot counts, and turnout if everyone eligible voted. Every number has a source URL. Returns 'no record found' when the ZIP is not covered.",
    inputSchema: z.object({ zip: z.string().describe("5-digit US ZIP code") }),
    execute: async ({ zip }) => getTurnout(zip) ?? { zip, status: "no record found" },
  }),
  getAccountability: tool({
    description:
      "Said vs did for one incumbent: each public promise paired with the vote, bill or action that kept or broke it, both sourced, plus a kept rate. Nonpartisan. Report the record; never tell the user who to vote for.",
    inputSchema: z.object({ name: z.string().describe("Politician name exactly as on the ballot") }),
    execute: async ({ name }) => {
      const records = getAccountability(name);
      return records.length ? { name, keptRate: keptRate(records), records } : { name, status: "no record found" };
    },
  }),
};

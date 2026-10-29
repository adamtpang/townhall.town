// AI SDK tools for the two plug-ins. Spread into the agent's tools:
//   tools: { ...existingTools, ...civicTools }
import { tool } from "ai";
import { z } from "zod";
import { trackRecordFor, METHOD_TEXT, METHOD_URL } from "./accountability";
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
      "Track record for one candidate: said-vs-did pairs, each marked consistent, inconsistent or mixed/unclear by a written rule, both halves sourced. A score appears only with 3+ checkable pairs. Nonpartisan. Report the record; never tell the user who to vote for.",
    inputSchema: z.object({ name: z.string().describe("Candidate name exactly as on the ballot") }),
    execute: async ({ name }) => {
      const t = trackRecordFor(name);
      return t ? { name, method: METHOD_TEXT, methodUrl: METHOD_URL, ...t } : { name, status: "no record found" };
    },
  }),
};

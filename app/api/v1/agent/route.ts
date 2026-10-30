// Canonical v1 ballot agent endpoint. Implementation: lib/api/agent.ts.
import { agentGET, agentNotAllowed, agentPOST } from "../../../../lib/api/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return agentGET(req);
}
export async function POST(req: Request) {
  return agentPOST(req);
}
export { agentNotAllowed as PUT, agentNotAllowed as PATCH, agentNotAllowed as DELETE };

import { NextResponse } from "next/server";
import { getAccountability, keptRate } from "../../../lib/accountability";

// GET /api/accountability?name=Greg%20Abbott
export function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  const records = getAccountability(name);
  return records.length
    ? NextResponse.json({ name, keptRate: keptRate(records), records })
    : NextResponse.json({ name, status: "no record found" }, { status: 404 });
}

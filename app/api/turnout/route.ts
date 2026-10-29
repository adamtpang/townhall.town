import { NextResponse } from "next/server";
import { getTurnout } from "../../../lib/turnout";

// GET /api/turnout?zip=78701
export function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip")?.trim() ?? "";
  const t = getTurnout(zip);
  return t ? NextResponse.json(t) : NextResponse.json({ zip, status: "no record found" }, { status: 404 });
}

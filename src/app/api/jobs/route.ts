/**
 * GET /api/jobs — list jobs with optional filters
 * Query params: ?status=new&minScore=70&limit=50&profileId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const minScore = parseInt(searchParams.get("minScore") || "0");
    const limit = parseInt(searchParams.get("limit") || "50");
    const profileId = searchParams.get("profileId");

    const where: any = {};
    if (status) where.status = status;
    if (minScore > 0) where.matchScore = { gte: minScore };
    if (profileId) where.searchProfileId = profileId;

    const jobs = await db.jobPosting.findMany({
      where,
      orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        searchProfile: {
          select: { name: true, cvVariant: { select: { slug: true, roleShort: true } } },
        },
      },
    });

    return NextResponse.json({ jobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

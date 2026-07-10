/**
 * GET /api/jobs — list jobs with optional filters
 * Query params: ?status=new&minScore=70&limit=200&profileId=xxx&maxAgeDays=21
 *
 * DELETE /api/jobs — clear jobs
 * ?olderThanDays=30  — delete jobs older than N days
 * ?all=true           — delete ALL jobs (fresh start)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const minScore = parseInt(searchParams.get("minScore") || "0");
    const limit = parseInt(searchParams.get("limit") || "200");
    const profileId = searchParams.get("profileId");
    const maxAgeDays = parseInt(searchParams.get("maxAgeDays") || "21");

    const where: any = {};
    if (status) where.status = status;
    if (minScore > 0) where.matchScore = { gte: minScore };
    if (profileId) where.searchProfileId = profileId;
    if (maxAgeDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxAgeDays);
      where.createdAt = { gte: cutoff };
    }

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

    return NextResponse.json({ jobs, filters: { maxAgeDays, minScore, status } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const purgeAll = searchParams.get("all") === "true";

    let result;
    if (purgeAll) {
      result = await db.jobPosting.deleteMany({});
      return NextResponse.json({
        success: true,
        deleted: result.count,
        message: `Purged all ${result.count} jobs — fresh start`,
      });
    }

    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    result = await db.jobPosting.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} jobs older than ${olderThanDays} days`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

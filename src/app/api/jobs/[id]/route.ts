/**
 * PATCH /api/jobs/[id] — update job status (new/viewed/applied/dismissed)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body as { status?: string };

    const validStatuses = ["new", "viewed", "applied", "dismissed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await db.jobPosting.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ job: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

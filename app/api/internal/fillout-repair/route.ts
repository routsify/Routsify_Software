import { NextRequest, NextResponse } from "next/server";
import { stageFilloutRepair } from "@/lib/fillout-repair-stage-server";
import { runFilloutRepair, validFilloutRepairToken } from "@/lib/fillout-repair-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ORGANIZATION_ID = "39894eda-ca91-45b6-9850-d278ca415139";
const phases = new Set(["stage", "reset", "enqueue", "process", "enrich", "verify"]);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const runId = request.nextUrl.searchParams.get("run_id") || "";
  const phase = request.nextUrl.searchParams.get("phase") || "";
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50);

  if (!validFilloutRepairToken(token)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) return NextResponse.json({ ok: false, error: "invalid_run_id" }, { status: 400 });
  if (!phases.has(phase)) return NextResponse.json({ ok: false, error: "invalid_phase" }, { status: 400 });

  try {
    const data = phase === "stage"
      ? await stageFilloutRepair(ORGANIZATION_ID, runId)
      : await runFilloutRepair({ organizationId: ORGANIZATION_ID, runId, phase: phase as "reset" | "enqueue" | "process" | "enrich" | "verify", limit });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "fillout_repair_failed" }, { status: 500 });
  }
}

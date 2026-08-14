import { NextResponse } from "next/server"
import { deleteGrowthTarget, setGrowthTarget } from "@/lib/db"
import { TARGET_METRICS } from "@/lib/metrics"

/**
 * PUT /api/metrics/targets  { metric, target }   (Authorization: Bearer <METRICS_ADMIN_TOKEN>)
 * DELETE /api/metrics/targets { metric }         (same auth)
 *
 * Team-only editing of the Stage 2 growth targets (the locked baseline).
 * Fails closed: without METRICS_ADMIN_TOKEN configured, editing is disabled.
 */
async function checkAdmin(request: Request): Promise<NextResponse | null> {
  const token = process.env.METRICS_ADMIN_TOKEN
  if (!token) {
    return NextResponse.json(
      { detail: "METRICS_ADMIN_TOKEN is not configured — target editing is disabled." },
      { status: 503 },
    )
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ detail: "Invalid admin token" }, { status: 401 })
  }
  return null
}

export async function PUT(request: Request) {
  const denied = await checkAdmin(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const { metric, target } = body || {}
  const def = TARGET_METRICS.find((m) => m.id === metric)
  if (!def) {
    return NextResponse.json({ detail: "Unknown metric" }, { status: 422 })
  }
  if (!Number.isFinite(Number(target)) || Number(target) <= 0) {
    return NextResponse.json({ detail: "target must be a positive number" }, { status: 422 })
  }

  await setGrowthTarget(def.id, def.label, Number(target))
  return NextResponse.json({ ok: true, metric: def.id, label: def.label, target: Number(target) })
}

export async function DELETE(request: Request) {
  const denied = await checkAdmin(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const { metric } = body || {}
  if (!metric || !TARGET_METRICS.some((m) => m.id === metric)) {
    return NextResponse.json({ detail: "Unknown metric" }, { status: 422 })
  }

  await deleteGrowthTarget(String(metric))
  return NextResponse.json({ ok: true, metric: String(metric) })
}

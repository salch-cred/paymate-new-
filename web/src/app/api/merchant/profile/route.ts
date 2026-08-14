import { NextResponse } from "next/server"
import { getAddress, isAddress } from "viem"
import { authenticateApiKey } from "@/lib/apikey"
import { getMerchantProfile, upsertMerchantProfile } from "@/lib/db"
import { generateWebhookSecret } from "@/lib/merchant"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"

/** GET /api/merchant/profile — the merchant profile for this API key. */
export async function GET(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const profile = await getMerchantProfile(key.id)
    if (!profile) {
      return NextResponse.json({
        ok: true,
        profile: {
          apiKeyId: key.id,
          storeName: key.name,
          logoUrl: null,
          receiveWallet: key.wallet,
          webhookUrl: null,
          successUrl: null,
          cancelUrl: null,
          webhookSecret: null,
          createdAt: null,
        },
      })
    }
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    console.error("Merchant profile error:", error)
    return NextResponse.json({ detail: "Failed to load merchant profile" }, { status: 500 })
  }
}

/** PUT /api/merchant/profile — update store name / receive wallet / webhooks. */
export async function PUT(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ detail: "Expected a JSON body" }, { status: 400 })
    }

    const fields: {
      storeName?: string
      logoUrl?: string
      receiveWallet?: string
      webhookUrl?: string | null
      successUrl?: string | null
      cancelUrl?: string | null
    } = {}

    if (body.storeName !== undefined) fields.storeName = String(body.storeName).slice(0, 120)
    if (body.logoUrl !== undefined) fields.logoUrl = String(body.logoUrl).slice(0, 500)
    if (body.receiveWallet !== undefined) {
      if (typeof body.receiveWallet !== "string" || !isAddress(body.receiveWallet)) {
        return NextResponse.json({ detail: "receiveWallet must be a valid 0x address" }, { status: 422 })
      }
      fields.receiveWallet = getAddress(body.receiveWallet)
    }
    if (body.webhookUrl !== undefined) {
      const url = body.webhookUrl ? String(body.webhookUrl) : null
      if (url && !isSafeWebhookUrl(url)) {
        return NextResponse.json(
          { detail: "webhookUrl must be a public https/http URL (no localhost or private ranges)" },
          { status: 422 },
        )
      }
      fields.webhookUrl = url
    }
    if (body.successUrl !== undefined) fields.successUrl = body.successUrl ? String(body.successUrl).slice(0, 500) : null
    if (body.cancelUrl !== undefined) fields.cancelUrl = body.cancelUrl ? String(body.cancelUrl).slice(0, 500) : null

    const existing = await getMerchantProfile(key.id)
    const profile = await upsertMerchantProfile(key.id, {
      ...fields,
      webhookSecret: existing?.webhookSecret || generateWebhookSecret(),
    })
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    console.error("Merchant profile update error:", error)
    return NextResponse.json({ detail: "Failed to update merchant profile" }, { status: 500 })
  }
}

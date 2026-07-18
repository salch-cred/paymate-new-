export async function GET() {
  return Response.json({ ok: true, service: "paymate-api", version: "2.0.0" })
}

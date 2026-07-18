export async function GET() {
  return Response.json({ ok: true, service: "paymate-api", version: "0.1.0" })
}

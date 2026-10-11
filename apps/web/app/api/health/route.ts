export async function GET() {
  return Response.json({ status: 'ok', service: 'magazala-web', timestamp: new Date().toISOString() });
}

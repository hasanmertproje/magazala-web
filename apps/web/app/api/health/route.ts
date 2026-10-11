export async function GET() {
  return Response.json({ status: 'ok', service: 'tasarlayalim-commerce-os', timestamp: new Date().toISOString() });
}

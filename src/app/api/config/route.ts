export const dynamic = 'force-dynamic';
export function GET() { return Response.json({ pixazo: !!process.env.PIXAZO_API_KEY, zai: !!process.env.ZAI_API_KEY }, { headers: { 'Cache-Control': 'no-store' } }); }

import { errorResponse, pixazo, normalizeResult } from '@/lib/server';
import { verifyTicket } from '@/lib/tickets';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const ref = verifyTicket(new URL(request.url).searchParams.get('ticket') || '', 'job');
    if (ref.kind !== 'job') throw new Error('Invalid job reference.');
    const data = await pixazo(`/v2/requests/status/${encodeURIComponent(ref.id)}`);
    return Response.json(normalizeResult(data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

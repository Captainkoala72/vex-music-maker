import { ApiError, errorResponse } from '@/lib/server';
import { verifyTicket } from '@/lib/tickets';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const ref = verifyTicket(params.get('ticket') || '', 'audio');
    if (ref.kind !== 'audio') throw new Error('Invalid audio reference.');
    const upstream = await fetch(ref.url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(55000) });
    if (!upstream.ok || !upstream.body) throw new ApiError('The audio file could not be downloaded. Your saved track has been kept. The provider URL may have expired.', 502);
    const ext = new URL(ref.url).pathname.match(/\.(mp3|wav|flac|ogg|opus|m4a|aac)$/i)?.[1] || 'mp3';
    const name = (params.get('name') || 'vex-track').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    return new Response(upstream.body, { headers: { 'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg', 'Content-Disposition': `attachment; filename="${name}.${ext}"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

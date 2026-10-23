import { isModel, MODELS, normalizeSettings, validatePrompt } from '@/lib/models';
import { checkOrigin, errorResponse, parseWebhook, pixazo, normalizeResult, readBody } from '@/lib/server';
import { signTicket } from '@/lib/tickets';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readBody(request);
    const model = body.model;
    if (!isModel(model)) throw new Error('Choose one of the three supported Pixazo models.');
    const prompt = validatePrompt(model, body.prompt);
    const settings = normalizeSettings(model, body.settings);
    const webhook = parseWebhook(body.webhookUrl, body.webhookMode ?? 'terminal', model);
    const data = await pixazo(MODELS[model].endpoint, { ...settings, prompt }, webhook);
    const result = normalizeResult(data);
    if (result.status !== 'COMPLETED' && result.status !== 'ERROR' && !data.request_id) throw new Error('Pixazo did not return a job reference. Check your dashboard before submitting again.');
    return Response.json({ ...result, ...(data.request_id ? { ticket: signTicket({ kind: 'job', id: data.request_id }) } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

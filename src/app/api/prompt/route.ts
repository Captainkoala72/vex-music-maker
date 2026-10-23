import { isModel, validatePrompt } from '@/lib/models';
import { ApiError, checkOrigin, errorResponse, promptInstructions, readBody, requireKey } from '@/lib/server';
export const runtime = 'nodejs';
export const maxDuration = 300;
type Message = { role: string; content?: string | null; tool_call_id?: string; tool_calls?: { id: string; type: string; function: { name: string; arguments: string | Record<string, unknown> } }[]; reasoning_content?: string };
const searchTool = { type: 'function', function: { name: 'web_search', description: 'Research the instrumentation, rhythm, and musical conventions of a genre to write a specific tennis-game soundtrack prompt.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'A concise musical genre research query.' } }, required: ['query'], additionalProperties: false } } };
async function zai(path: string, body: unknown) {
  const response = await fetch(`https://api.z.ai/api/paas/v4/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${requireKey('ZAI_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new ApiError(`zAI (${response.status}): ${data.error?.message || data.message || 'The prompt writer is unavailable.'}`, response.status >= 500 ? 502 : response.status);
  return data;
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readBody(request);
    if (!isModel(body.model)) throw new Error('Choose a music model first.');
    if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 4000) throw new Error('Describe your style in 1–4,000 characters.');
    const webSearch = body.webSearch === true;
    const messages: Message[] = [{ role: 'system', content: promptInstructions(body.model, body.instrumental !== false) }, { role: 'user', content: body.description }];
    let searches = 0;
    for (let round = 0; round < 4; round++) {
      const canSearch = webSearch && searches < 3 && round < 3;
      const data = await zai('chat/completions', { model: 'glm-5.3-flash', messages, thinking: { type: 'enabled', clear_thinking: false }, reasoning_effort: 'high', temperature: 1, top_p: 0.95, max_tokens: 8192, stream: false, ...(canSearch ? { tools: [searchTool], tool_choice: 'auto' } : {}) });
      const message = data.choices?.[0]?.message as Message | undefined;
      if (!message) throw new ApiError('zAI returned no prompt. Please try again.', 502);
      if (!message.tool_calls?.length) {
        if (data.choices?.[0]?.finish_reason === 'length') throw new ApiError('The prompt writer reached its output limit. Please try a shorter description.', 502);
        const prompt = validatePrompt(body.model, message.content?.trim());
        return Response.json({ prompt, searches, model: 'glm-5.3-flash', reasoningEffort: 'high' }, { headers: { 'Cache-Control': 'no-store' } });
      }
      messages.push(message); // Preserve the provider's reasoning_content across tool calls.
      for (const call of message.tool_calls) {
        let result: unknown = { error: 'Search is disabled or the search budget is exhausted. Write the final prompt now.' };
        if (canSearch && searches < 3 && call.function.name === 'web_search') {
          const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
          if (typeof args.query === 'string' && args.query.trim()) {
            searches++;
            const found = await zai('web_search', { search_engine: 'search-prime', search_query: args.query.slice(0, 500), count: 5 });
            result = found.search_result || [];
          }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 18000) });
      }
    }
    throw new ApiError('The prompt writer did not finish after its search calls. Try again with web search off.', 502);
  } catch (error) { return errorResponse(error); }
}

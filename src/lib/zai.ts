import { ApiError, requireKey } from './server';

export async function zai(path: 'chat/completions' | 'web_search', body: unknown) {
  const response = await fetch(`https://api.z.ai/api/paas/v4/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${requireKey('ZAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90000), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(`zAI (${response.status}): ${data.error?.message || data.message || 'The AI writer is unavailable.'}`, response.status >= 500 ? 502 : response.status);
  return data;
}

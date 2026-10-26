import { randomInt } from 'node:crypto';
import { isModel, validatePrompt } from '@/lib/models';
import { PRESETS } from '@/lib/presets';
import { ApiError, checkOrigin, errorResponse, promptInstructions, readBody } from '@/lib/server';
import { zai } from '@/lib/zai';

export const runtime = 'nodejs';
export const maxDuration = 120;
const genres = [...PRESETS.map(p => p.genre), 'Brazilian boogie', 'Acid jazz', 'Italo disco', 'Jazztronica', 'Nu-disco', 'Future funk', 'Downtempo dub', 'Organic house', 'Broken beat', 'Instrumental hip-hop', 'Dream pop', 'Afro-Cuban jazz', 'Tropical synth-pop', 'Minimal techno', 'Library music funk', 'Highlife', 'Chill electro', 'Latin jazz fusion', 'Electro swing', 'UK funky', 'Samba funk', 'Indie dance', 'Future garage', 'Progressive breaks'];
const scenes = ['a neon rooftop court at dusk', 'a breezy seaside training court', 'an indoor winter exhibition', 'a friendly midnight doubles match', 'a colorful low-poly tournament lobby', 'a sunny mountain resort court', 'a retro character-select screen', 'a floating space-station court'];
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readBody(request);
    const model = body.model;
    if (!isModel(model)) throw new Error('Choose a music model first.');
    const choices = genres.filter(genre => genre !== body.previousGenre);
    const genre = choices[randomInt(choices.length)];
    const scene = scenes[randomInt(scenes.length)];
    const data = await zai('chat/completions', {
      model: 'glm-5.3-flash', reasoning_effort: 'high', thinking: { type: 'enabled' },
      temperature: 1, top_p: 0.95, max_tokens: 8192, stream: false,
      messages: [
        { role: 'system', content: promptInstructions(model, body.instrumental !== false) },
        { role: 'user', content: `Invent a fresh original tennis-game soundtrack prompt in the randomly selected genre: ${genre}. Setting: ${scene}. Choose a suitable BPM, distinctive instruments, an original melodic direction, and an even loop-friendly arrangement. Write it in the style of a detailed production brief, like a carefully crafted soundtrack preset. Do not name existing artists or songs. This should be a new composition idea rather than a copy of any preset.` },
      ],
    });
    if (data.choices?.[0]?.finish_reason === 'length') throw new ApiError('The random prompt reached its output limit. Try another roll.', 502);
    const prompt = validatePrompt(model, data.choices?.[0]?.message?.content?.trim());
    return Response.json({ prompt, genre, model: 'glm-5.3-flash', reasoningEffort: 'high' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

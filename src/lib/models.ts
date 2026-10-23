export const MODEL_IDS = ['minimax-music-3-0', 'mureka-instrumental', 'stable-audio-3-small-music-text-to-audio'] as const;
export type ModelId = typeof MODEL_IDS[number];
export type Settings = Record<string, string | number | boolean>;
export type PromptMode = 'preset' | 'ai' | 'direct';
export type Field = { key: string; label: string; type: 'select' | 'number' | 'text' | 'textarea' | 'toggle'; options?: (string | number)[]; min?: number; max?: number; step?: number; hint?: string; optional?: boolean };
export const MODELS: Record<ModelId, { name: string; short: string; caption: string; endpoint: string; docs: string; maxPrompt: number; defaults: Settings; fields: Field[] }> = {
  'minimax-music-3-0': {
    name: 'MiniMax Music 3.0', short: 'MiniMax', caption: 'Full-length melodies', endpoint: '/minimax-music-3-0/v1/text-to-music', docs: 'https://www.pixazo.ai/models/minimax#text-to-music', maxPrompt: 2000,
    defaults: { is_instrumental: true, lyrics_optimizer: false, lyrics: '', format: 'mp3', sample_rate: 44100, bitrate: 256000 },
    fields: [
      { key: 'format', label: 'Audio format', type: 'select', options: ['mp3', 'wav'] },
      { key: 'sample_rate', label: 'Sample rate · Hz', type: 'select', options: [16000, 24000, 32000, 44100] },
      { key: 'bitrate', label: 'Bitrate · bits/s', type: 'select', options: [32000, 64000, 128000, 256000] },
      { key: 'is_instrumental', label: 'Instrumental only', type: 'toggle', hint: 'On by default for game soundtracks. Switch off to access lyrics.' },
      { key: 'lyrics_optimizer', label: 'Auto-write lyrics', type: 'toggle', hint: 'Available with instrumental mode off. Choose auto lyrics or write your own.' },
      { key: 'lyrics', label: 'Lyrics', type: 'textarea', max: 3500, hint: 'Required when both instrumental and auto lyrics are off. Up to 3,500 characters.' },
    ],
  },
  'mureka-instrumental': {
    name: 'Mureka Instrumental', short: 'Mureka', caption: 'Rich instrumental detail', endpoint: '/mureka-instrumental/v1/text-to-music', docs: 'https://www.pixazo.ai/models/mureka#text-to-music', maxPrompt: 1024,
    defaults: { model: 'mureka-9.5', sync_mode: false },
    fields: [{ key: 'model', label: 'Model version', type: 'select', options: ['mureka-7.6', 'mureka-8', 'mureka-9', 'mureka-9.5'], hint: '9.5 is the default. Each version has its own Pixazo rate.' }],
  },
  'stable-audio-3-small-music-text-to-audio': {
    name: 'Stable Audio 3 Small', short: 'Stable Audio', caption: 'Precise creative control', endpoint: '/stable-audio-3-small-music-text-to-audio/v1/stable-audio-3-small-music-text-to-audio-request', docs: 'https://www.pixazo.ai/models/stable-audio', maxPrompt: 10000,
    defaults: { negative_prompt: '', duration: 30, num_inference_steps: 8, guidance_scale: 1, output_format: 'mp3', bitrate: '192k', enable_prompt_expansion: false, enable_safety_checker: true, seed: '', sync_mode: false },
    fields: [
      { key: 'duration', label: 'Duration · seconds', type: 'number', min: 1, max: 380, step: 0.1 },
      { key: 'num_inference_steps', label: 'Inference steps', type: 'number', min: 1, max: 100, step: 1 },
      { key: 'guidance_scale', label: 'Prompt guidance', type: 'number', min: 0, max: 25, step: 0.1 },
      { key: 'seed', label: 'Seed · optional', type: 'number', step: 1, optional: true, hint: 'Blank for random. A fixed seed may reproduce a result.' },
      { key: 'output_format', label: 'Audio format', type: 'select', options: ['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'aac'] },
      { key: 'bitrate', label: 'Bitrate', type: 'text', hint: 'For example 128k, 192k, or 320k.' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'textarea', hint: 'Describe qualities to avoid, such as vocals, distortion, or dramatic drops.' },
      { key: 'enable_prompt_expansion', label: 'Prompt expansion', type: 'toggle', hint: 'Let Stable Audio enrich the supplied prompt.' },
      { key: 'enable_safety_checker', label: 'Safety checker', type: 'toggle' },
      { key: 'sync_mode', label: 'Synchronous output', type: 'toggle', hint: 'Returns inline audio. Large inline files may exceed Vercel response or browser storage limits; asynchronous output is recommended.' },
    ],
  },
};
export function isModel(value: unknown): value is ModelId { return MODEL_IDS.includes(value as ModelId); }
export function normalizeSettings(model: ModelId, input: unknown): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Model settings are required.');
  const values = input as Settings;
  const settings: Settings = {};
  for (const field of MODELS[model].fields) {
    const value = values[field.key] ?? MODELS[model].defaults[field.key];
    if (field.optional && value === '') continue;
    if (field.type === 'toggle' && typeof value !== 'boolean') throw new Error(`${field.label} must be on or off.`);
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max) || (field.step === 1 && !Number.isSafeInteger(value)))) throw new Error(`${field.label} is outside its supported range.`);
    if (field.type === 'select' && !field.options?.includes(value as string | number)) throw new Error(`Choose a supported ${field.label.toLowerCase()}.`);
    if ((field.type === 'text' || field.type === 'textarea') && (typeof value !== 'string' || value.length > (field.max ?? 10000))) throw new Error(`${field.label} is invalid or too long.`);
    settings[field.key] = value;
  }
  if (model === 'minimax-music-3-0') {
    if (settings.is_instrumental) { delete settings.lyrics; settings.lyrics_optimizer = false; }
    else if (settings.lyrics_optimizer) delete settings.lyrics;
    else if (!String(settings.lyrics).trim()) throw new Error('Enter lyrics, enable auto lyrics, or use instrumental mode.');
  }
  if (model === 'mureka-instrumental') settings.sync_mode = false;
  return settings;
}
export function validatePrompt(model: ModelId, prompt: unknown): string {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Write a prompt or select a preset first.');
  if (prompt.length > MODELS[model].maxPrompt) throw new Error(`This model accepts up to ${MODELS[model].maxPrompt.toLocaleString()} prompt characters.`);
  return prompt; // Preserve exact text for remakes.
}

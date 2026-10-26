import type { ModelId, PromptMode, Settings } from './models';
export type Song = {
  id: string; title: string; model: ModelId; prompt: string; settings: Settings;
  mode: PromptMode; presetId?: string; description?: string; webSearch?: boolean;
  randomPrompt?: boolean; randomGenre?: string;
  webhookUrl?: string; webhookMode?: string;
  createdAt: string; status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  ticket?: string; audioUrl?: string; downloadTicket?: string; mediaType?: string;
  error?: string; downloaded?: boolean;
};
export const STORAGE_KEY = 'vex-undownloaded-tracks-v1';
export function persistedSongs(songs: Song[]): Song[] { return songs.filter(s => !s.downloaded); }
export function readSongs(): Song[] {
  const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(value)) throw new Error('Saved tracks could not be read.');
  return value.filter(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.prompt === 'string' && typeof s.model === 'string' && s.settings && ['QUEUED', 'PROCESSING', 'COMPLETED', 'ERROR'].includes(s.status) && !s.downloaded) as Song[];
}
export function writeSongs(songs: Song[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedSongs(songs))); }

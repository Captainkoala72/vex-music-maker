export function validateSongTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a song name.');
  const title = value.trim();
  if (title.length > 100 || /[\r\n]/.test(title)) throw new Error('Use a single-line song name of up to 100 characters.');
  return title;
}

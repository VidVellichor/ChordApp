export type Repeat = 'off' | 'all' | 'one';
export interface LocalTrack { id: string; title: string; filename: string; url: string; size: number }
export function formatTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export function acceptsAudio(file: Pick<File, 'name' | 'type' | 'size'>): boolean {
  return file.size > 0 && (file.type.startsWith('audio/') || /\.(wav|mp3|flac|m4a|ogg|aac|opus|aiff|webm)$/i.test(file.name));
}
export function nextTrack(ids: string[], current: string | null, direction: 1 | -1, repeat: Repeat, shuffle: boolean, ended = false, random = Math.random): string | null {
  if (!ids.length) return null;
  const index = ids.indexOf(current ?? '');
  if (ended && repeat === 'one' && index >= 0) return current;
  if (shuffle && ids.length > 1) {
    const candidates = ids.filter(id => id !== current);
    return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))];
  }
  const next = index < 0 ? 0 : index + direction;
  if (next >= 0 && next < ids.length) return ids[next];
  return repeat === 'all' ? ids[(next + ids.length) % ids.length] : null;
}
export function releaseTracks(tracks: LocalTrack[], revoke: (url: string) => void = URL.revokeObjectURL): void {
  tracks.forEach(track => revoke(track.url));
}

export function positionAt(offset: number, startedAt: number, now: number, duration: number): number {
  return Math.min(duration, Math.max(0, offset + Math.max(0, now - startedAt)));
}
export interface TrackMix { mute: boolean; solo: boolean; volume: number }
export function effectiveGain(track: TrackMix, anySolo: boolean): number {
  return track.mute || (anySolo && !track.solo) ? 0 : Math.min(1, Math.max(0, track.volume));
}

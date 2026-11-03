import type { Library } from './library';
export function removeTrack(state: Library, id: string): Library {
  return { tracks: state.tracks.filter(t => t.id !== id), favorites: state.favorites.filter(value => value !== id), playlists: state.playlists.map(p => ({ ...p, trackIds: p.trackIds.filter(value => value !== id) })) };
}
export function toggleFavorite(state: Library, id: string): Library {
  if (!state.tracks.some(t => t.id === id)) return state;
  return { ...state, favorites: state.favorites.includes(id) ? state.favorites.filter(value => value !== id) : [...state.favorites, id] };
}
export function setPlaylistTrack(state: Library, playlistId: string, id: string, included: boolean): Library {
  if (!state.tracks.some(t => t.id === id)) return state;
  return { ...state, playlists: state.playlists.map(p => p.id !== playlistId ? p : { ...p, trackIds: included ? [...new Set([...p.trackIds, id])] : p.trackIds.filter(value => value !== id) }) };
}

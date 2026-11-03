import { useState } from 'react';
import type { Library } from './library';
import { setPlaylistTrack, toggleFavorite } from './playlists';

type Update = (change: (value: Library) => Library) => Promise<void>;
export function LibraryFilters({ library, view, setView, update }: { library: Library; view: string; setView: (id: string) => void; update: Update }) {
  const [name, setName] = useState('');
  return <div className="mz-library-controls">
    <label>Collection<select value={view} onChange={e => setView(e.target.value)}>
      <option value="all">All tracks</option><option value="favorites">Favorites</option>
      {library.playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <form onSubmit={e => { e.preventDefault(); const title = name.trim(); if (!title) return; void update(value => ({ ...value, playlists: [...value.playlists, { id: crypto.randomUUID(), name: title, trackIds: [] }] })); setName(''); }}>
      <input aria-label="New playlist name" placeholder="New playlist name" maxLength={80} value={name} onChange={e => setName(e.target.value)} required />
      <button type="submit">Create playlist</button>
    </form>
  </div>;
}
export function TrackActions({ id, library, update, onDelete }: { id: string; library: Library; update: Update; onDelete: () => void }) {
  return <div className="mz-track-actions">
    <button aria-pressed={library.favorites.includes(id)} onClick={() => void update(value => toggleFavorite(value, id))}>{library.favorites.includes(id) ? 'Favorited' : 'Favorite'}</button>
    <details><summary>Playlists</summary><div className="mz-memberships">
      {library.playlists.length === 0 && <p>Create a playlist above first.</p>}
      {library.playlists.map(p => <label key={p.id}><input type="checkbox" checked={p.trackIds.includes(id)} onChange={e => { const included = e.target.checked; void update(value => setPlaylistTrack(value, p.id, id, included)); }} />{p.name}</label>)}
    </div></details>
    <button className="mz-delete" onClick={onDelete}>Delete song</button>
  </div>;
}

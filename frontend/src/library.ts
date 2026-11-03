export interface StoredTrack { id: string; title: string; filename: string; size: number; blob: Blob }
export interface Playlist { id: string; name: string; trackIds: string[] }
export interface Library { tracks: StoredTrack[]; favorites: string[]; playlists: Playlist[] }
export const emptyLibrary = (): Library => ({ tracks: [], favorites: [], playlists: [] });

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('mozart-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Mozart tabs to update the library.'));
  });
}

export async function loadLibrary(factory: IDBFactory = indexedDB): Promise<Library> {
  const db = await open(factory);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readonly');
    const request = transaction.objectStore('library').get('collection');
    transaction.oncomplete = () => { db.close(); resolve(request.result ?? emptyLibrary()); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Library read failed.')); };
  });
}

export async function saveLibrary(state: Library, factory: IDBFactory = indexedDB): Promise<void> {
  const db = await open(factory);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite');
    // Explicit projection ensures transient object URLs never reach disk.
    const tracks = state.tracks.map(({ id, title, filename, size, blob }) => ({ id, title, filename, size, blob }));
    transaction.objectStore('library').put({ ...state, tracks }, 'collection');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Library write failed.')); };
  });
}

import { useEffect, useRef, useState } from 'react';
import { emptyLibrary, loadLibrary, saveLibrary, type Library } from './library';
import { acceptsAudio, type LocalTrack } from './playback';

export function useLibrary() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const state = useRef(library);
  const urls = useRef(new Map<string, string>());
  const writes = useRef(Promise.resolve());
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void loadLibrary().then(value => {
      if (cancelled) return;
      state.current = value;
      setLibrary(value);
      setTracks(value.tracks.map(t => {
        const url = URL.createObjectURL(t.blob);
        urls.current.set(t.id, url);
        return { ...t, url };
      }));
      setReady(true);
    }).catch(() => { if (!cancelled) setError('Library could not be opened. Check browser storage permissions, then reload.'); });
    return () => {
      cancelled = true;
      alive.current = false;
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current.clear();
    };
  }, []);

  async function update(change: (value: Library) => Library) {
    if (!ready) return;
    const operation = writes.current.then(async () => {
      const next = change(state.current);
      await saveLibrary(next);
      if (!alive.current) return;
      state.current = next;
      setLibrary(next);
      setTracks(next.tracks.map(t => {
        let url = urls.current.get(t.id);
        if (!url) { url = URL.createObjectURL(t.blob); urls.current.set(t.id, url); }
        return { ...t, url };
      }));
      // React has committed the new source before old URLs are released.
      setTimeout(() => {
        urls.current.forEach((url, id) => {
          if (!state.current.tracks.some(t => t.id === id)) { URL.revokeObjectURL(url); urls.current.delete(id); }
        });
      }, 0);
      setError('');
    });
    writes.current = operation.catch(() => { if (alive.current) setError('Changes were not saved. Browser storage may be full or unavailable.'); });
    await writes.current;
  }

  async function importFiles(files: File[]) {
    const valid = files.filter(acceptsAudio);
    await update(value => ({ ...value, tracks: [...value.tracks, ...valid.map(file => ({ id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ''), filename: file.name, size: file.size, blob: file }))] }));
    if (valid.length !== files.length) setError('Some empty or unsupported files were skipped.');
  }
  return { library, tracks, ready, error, update, importFiles };
}

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { loadLibrary, saveLibrary } from './library.ts';

test('IndexedDB round trips actual audio bytes without persisting object URLs', async () => {
  const state = { tracks: [{ id: 'a', title: 'Song', filename: 'song.wav', size: 3, blob: new Blob(['abc']) }], favorites: ['a'], playlists: [{ id: 'p', name: 'Practice', trackIds: ['a'] }] };
  await saveLibrary(state, indexedDB);
  const restored = await loadLibrary(indexedDB);
  assert.equal(await restored.tracks[0].blob.text(), 'abc');
  assert.equal('url' in restored.tracks[0], false);
  assert.deepEqual(restored.favorites, ['a']);
  assert.deepEqual(restored.playlists, state.playlists);
});

 test('a new database loads an empty collection', async () => {
  assert.deepEqual(await loadLibrary(new (indexedDB.constructor as {new(): IDBFactory})()), { tracks: [], favorites: [], playlists: [] });
});


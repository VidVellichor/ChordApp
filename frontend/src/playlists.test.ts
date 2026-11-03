import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { removeTrack, toggleFavorite, setPlaylistTrack } from './playlists.ts';
import type { Library } from './library.ts';
const state: Library = { tracks: [{id:'a', title:'A', filename:'a.wav', size:1, blob:new Blob(['a'])}], favorites:['a'], playlists:[{id:'p',name:'Practice',trackIds:['a']}] };
test('deleting audio removes favorites and every playlist reference without mutating input', () => {
  const result = removeTrack(state, 'a');
  assert.deepEqual(result, {tracks:[],favorites:[],playlists:[{id:'p',name:'Practice',trackIds:[]}]});
  assert.equal(state.tracks.length, 1);
});
test('playlist membership is unique, removable and rejects nonexistent songs', () => {
  assert.deepEqual(setPlaylistTrack(state,'p','a',true).playlists[0].trackIds,['a']);
  assert.deepEqual(setPlaylistTrack(state,'p','a',false).playlists[0].trackIds,[]);
  assert.deepEqual(setPlaylistTrack(state,'p','missing',true),state);
});
test('favorites toggle in both directions and ignore nonexistent songs', () => {
  assert.deepEqual(toggleFavorite(state,'a').favorites,[]);
  assert.deepEqual(toggleFavorite({...state,favorites:[]},'a').favorites,['a']);
  assert.deepEqual(toggleFavorite(state,'missing'),state);
});

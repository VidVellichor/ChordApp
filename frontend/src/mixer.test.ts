import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionAt, effectiveGain } from './mixer.ts';

test('mute overrides solo and solo silences other tracks', () => {
  assert.equal(effectiveGain({ mute: true, solo: true, volume: 1 }, true), 0);
  assert.equal(effectiveGain({ mute: false, solo: false, volume: 1 }, true), 0);
  assert.equal(effectiveGain({ mute: false, solo: true, volume: 0.6 }, true), 0.6);
  assert.equal(effectiveGain({ mute: false, solo: false, volume: 0.8 }, false), 0.8);
});


test('shared clock preserves pause offset and clamps at track duration', () => {
  assert.equal(positionAt(4, 10, 12.5, 20), 6.5);
  assert.equal(positionAt(4, 10, 40, 20), 20);
  assert.equal(positionAt(4, 10, 9, 20), 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSegment, parseAnalysis } from './chords.ts';

test('chord timeline follows half-open playback intervals and ends without a chord', () => {
  const segments = [{ start: 0, end: 2, chord: 'C', confidence: 0.8 }, { start: 2, end: 4, chord: 'Am', confidence: 0.7 }];
  assert.equal(activeSegment(segments, 0), 0);
  assert.equal(activeSegment(segments, 2), 1);
  assert.equal(activeSegment(segments, 4), -1);
  assert.equal(activeSegment(segments, -1), -1);
});

test('rejects invalid or overlapping API timestamps instead of displaying them', () => {
  const valid = { duration: 4, method: 'experimental', limitations: ['Major/minor only'], segments: [{ start: 0, end: 4, chord: 'C', confidence: 0.8 }] };
  assert.equal(parseAnalysis(valid).segments[0].chord, 'C');
  assert.throws(() => parseAnalysis({ ...valid, segments: [{ start: 0, end: 5, chord: 'C', confidence: 0.8 }] }));
  assert.throws(() => parseAnalysis({ ...valid, segments: [{ start: 0, end: 3, chord: 'C', confidence: 0.8 }, { start: 2, end: 4, chord: 'D', confidence: 0.9 }] }));
  assert.throws(() => parseAnalysis({ ...valid, segments: [{ start: 0, end: 4, chord: '<script>', confidence: 0.8 }] }));
});

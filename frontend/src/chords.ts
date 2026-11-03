export interface ChordSegment { start: number; end: number; chord: string; confidence: number }
export interface ChordAnalysis { duration: number; method: string; limitations: string[]; segments: ChordSegment[] }

export function activeSegment(segments: ChordSegment[], time: number): number {
  return segments.findIndex(segment => time >= segment.start && time < segment.end);
}

export function parseAnalysis(value: unknown): ChordAnalysis {
  const invalid = () => new Error('The local API returned an invalid chord timeline.');
  if (!value || typeof value !== 'object') throw invalid();
  const result = value as Partial<ChordAnalysis>;
  if (typeof result.duration !== 'number' || !Number.isFinite(result.duration) || result.duration <= 0 ||
      typeof result.method !== 'string' || !Array.isArray(result.limitations) ||
      !result.limitations.every(item => typeof item === 'string') || !Array.isArray(result.segments)) throw invalid();
  let end = 0;
  for (const segment of result.segments) {
    if (!segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) ||
        segment.start < end || segment.start < 0 || segment.end <= segment.start || segment.end > result.duration + 0.01 ||
        typeof segment.chord !== 'string' || !/^(?:[A-G](?:#|b)?m?|N)$/.test(segment.chord) ||
        !Number.isFinite(segment.confidence) || segment.confidence < 0 || segment.confidence > 1) throw invalid();
    end = segment.end;
  }
  return result as ChordAnalysis;
}

import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import { parseAnalysis, type ChordAnalysis } from './chords';

export function useChords(trackId: string | null) {
  const [analysis, setAnalysis] = useState<ChordAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setAnalysis(null); setError(''); setLoading(false);
    return () => controller.current?.abort();
  }, [trackId]);

  async function analyze(blob: Blob, filename: string) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true); setError(''); setAnalysis(null);
    const body = new FormData();
    body.append('file', blob, filename);
    try {
      const result = await request<unknown>('/api/chords', { method: 'POST', body, signal: current.signal });
      if (!current.signal.aborted) setAnalysis(parseAnalysis(result));
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chord analysis failed. Check the local API.');
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }
  return { analysis, loading, error, analyze };
}

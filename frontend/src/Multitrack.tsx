import { useEffect, useRef, useState } from 'react';
import { effectiveGain, positionAt, type TrackMix } from './mixer';
import { isWav, localFileUrl, type OutputFile } from './api';

interface Track extends TrackMix { name: string; buffer: AudioBuffer; peaks: number[] }
interface Session {
  context: AudioContext; sources: AudioBufferSourceNode[]; gains: GainNode[];
  offset: number; startedAt: number; playing: boolean; duration: number;
}
const time = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
function halt(session: Session) {
  for (const source of session.sources) { source.stop(); source.disconnect(); }
  for (const gain of session.gains) gain.disconnect();
  session.sources = []; session.gains = []; session.playing = false;
}
function current(session: Session) {
  return session.playing ? positionAt(session.offset, session.startedAt, session.context.currentTime, session.duration) : session.offset;
}
function peaksFor(buffer: AudioBuffer): number[] {
  const samples = buffer.getChannelData(0);
  return Array.from({ length: 240 }, (_, index) => {
    const start = Math.floor(index * samples.length / 240);
    const end = Math.floor((index + 1) * samples.length / 240);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    return peak;
  });
}
export function Multitrack({ files }: { files: OutputFile[] }) {
  const sessionRef = useRef<Session | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const mounted = useRef(true);
  const loadController = useRef<AbortController | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadController.current?.abort();
      const session = sessionRef.current;
      if (session) { halt(session); void session.context.close(); }
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const session = sessionRef.current;
      if (!session) return;
      const next = current(session);
      setPosition(next);
      if (next >= session.duration) {
        halt(session); session.offset = 0; setPlaying(false); setPosition(0);
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  async function load() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setError(''); setLoading(true);
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const wavs = files.filter(isWav);
      if (!wavs.length) throw new Error('This job did not return WAV files. Download available outputs below.');
      const decoded = await Promise.all(wavs.map(async file => {
        const response = await fetch(localFileUrl(file.url), { signal: controller.signal });
        if (!response.ok) throw new Error(`Could not load ${file.name} (${response.status}). Run separation again if the job expired.`);
        const buffer = await context!.decodeAudioData(await response.arrayBuffer());
        return { name: file.name, buffer, peaks: peaksFor(buffer), mute: false, solo: false, volume: 1 };
      }));
      if (!mounted.current || controller.signal.aborted) { await context.close(); return; }
      const previous = sessionRef.current;
      if (previous) { halt(previous); void previous.context.close(); }
      sessionRef.current = { context, sources: [], gains: [], offset: 0, startedAt: 0, playing: false, duration: Math.max(...decoded.map(track => track.buffer.duration)) };
      tracksRef.current = decoded; setTracks(decoded); setPosition(0); setPlaying(false);
    } catch (cause) {
      const cancelled = controller.signal.aborted;
      controller.abort();
      if (context && context !== sessionRef.current?.context) void context.close();
      if (mounted.current && !cancelled) setError(cause instanceof Error ? cause.message : 'Audio decoding failed. Try another browser or download the WAV files.');
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
        if (mounted.current) setLoading(false);
      }
    }
  }
  function schedule(session: Session, offset: number) {
    halt(session);
    session.offset = Math.max(0, Math.min(offset, session.duration));
    if (session.offset >= session.duration) session.offset = 0;
    // All stems use this one context timestamp and the same seek offset.
    session.startedAt = session.context.currentTime + 0.04;
    const anySolo = tracksRef.current.some(track => track.solo);
    for (const track of tracksRef.current) {
      const source = session.context.createBufferSource();
      const gain = session.context.createGain();
      source.buffer = track.buffer;
      gain.gain.value = effectiveGain(track, anySolo);
      source.connect(gain).connect(session.context.destination);
      if (session.offset < track.buffer.duration) source.start(session.startedAt, session.offset);
      session.sources.push(source); session.gains.push(gain);
    }
    session.playing = true; setPlaying(true); setPosition(session.offset);
  }
  async function play() {
    const session = sessionRef.current;
    if (!session || starting) return;
    setStarting(true); setError('');
    try {
      await session.context.resume();
      if (mounted.current && session === sessionRef.current) schedule(session, session.offset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audio could not start. Check browser audio permissions.'); }
    finally { if (mounted.current) setStarting(false); }
  }
  function pause() {
    const session = sessionRef.current;
    if (!session) return;
    const offset = current(session); halt(session); session.offset = offset;
    setPosition(offset); setPlaying(false);
  }
  function stop() {
    const session = sessionRef.current;
    if (!session) return;
    halt(session); session.offset = 0; setPosition(0); setPlaying(false);
  }
  function seek(value: number) {
    const session = sessionRef.current;
    if (!session) return;
    const offset = Math.min(session.duration, Math.max(0, value));
    if (session.playing && offset < session.duration) schedule(session, offset);
    else { halt(session); session.offset = offset; setPosition(offset); setPlaying(false); }
  }
  function mix(index: number, patch: Partial<TrackMix>) {
    const next = tracksRef.current.map((track, i) => i === index ? { ...track, ...patch } : track);
    tracksRef.current = next; setTracks(next);
    const session = sessionRef.current;
    if (session) next.forEach((track, i) => session.gains[i]?.gain.setTargetAtTime(effectiveGain(track, next.some(item => item.solo)), session.context.currentTime, 0.015));
  }
  const duration = sessionRef.current?.duration ?? 0;
  return <section className="mixer" aria-labelledby="mixer-title">
    <div className="section-heading"><div><h2 id="mixer-title">Stem mixer</h2><p>One clock. Independent track levels.</p></div>
      <button onClick={() => void load()} disabled={loading || starting}>{loading ? 'Decoding WAV files…' : tracks.length ? 'Reload WAV files' : 'Load WAV files'}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!tracks.length && <p className="empty">Load the completed WAV outputs to audition stems. Audio is decoded in browser memory; long tracks can use substantial RAM.</p>}
    {!!tracks.length && <>
      <div className="transport">
        <button className="primary" disabled={starting || loading} onClick={playing ? pause : () => void play()}>{starting ? 'Starting…' : playing ? 'Pause' : 'Play'}</button>
        <button onClick={stop} disabled={starting}>Stop</button>
        <output className="time" aria-label="Playback time">{time(position)} / {time(duration)}</output>
        <label className="seek">Seek<input aria-label="Seek all stems" type="range" min="0" max={duration} step="0.05" value={position} disabled={starting} onChange={event => seek(Number(event.target.value))}/></label>
      </div>
      <div className="track-list">{tracks.map((track, index) => <div className="track" key={track.name}>
        <div className="track-name">{track.name}</div>
        <svg className="waveform" viewBox="0 0 480 64" role="img" aria-label={`Decoded waveform of ${track.name}`} preserveAspectRatio="none">
          {track.peaks.map((peak, i) => <line key={i} x1={i * 2} x2={i * 2} y1={32 - peak * 30} y2={32 + peak * 30}/>)}
          <line className="playhead" x1={duration ? position / duration * 480 : 0} x2={duration ? position / duration * 480 : 0} y1="0" y2="64"/>
        </svg>
        <div className="track-controls"><button aria-label={`Mute ${track.name}`} aria-pressed={track.mute} onClick={() => mix(index, { mute: !track.mute })}>Mute</button>
          <button aria-label={`Solo ${track.name}`} aria-pressed={track.solo} onClick={() => mix(index, { solo: !track.solo })}>Solo</button>
          <label>Level <output>{Math.round(track.volume * 100)}%</output><input aria-label={`Volume ${track.name}`} type="range" min="0" max="1" step="0.01" value={track.volume} onChange={event => mix(index, { volume: Number(event.target.value) })}/></label></div>
      </div>)}</div>
      <p className="hint">Solo isolates selected stems. Mute takes priority. Full-level stems may clip when summed; lower track levels if needed.</p>
    </>}
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { request, localFileUrl, type Job } from './api';
import { Multitrack } from './Multitrack';
import './styles.css';
export default function Studio() {
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const [file,setFile]=useState<File|null>(null);
  const [model,setModel]=useState('htdemucs');
  const [job,setJob]=useState<Job|null>(null);
  const [error,setError]=useState('');
  const [sending,setSending]=useState(false);
  const [health,setHealth]=useState('Checking local engine…');
  useEffect(()=>{void request<{demucs:boolean;ffmpeg:boolean;ffprobe:boolean}>('/api/health').then(h=>setHealth(h.demucs&&h.ffmpeg&&h.ffprobe?'Local engine available':'Engine setup required — see INFERENCE.md')).catch(()=>setHealth('Local API unavailable — start the backend'));},[]);
  const active=job?.status==='queued'||job?.status==='running';
  useEffect(()=>{
    if(!job||!active)return;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      let keepPolling=true;
      try{
        const next=await request<Job>(`/api/jobs/${job!.id}`,{signal:controller.signal});
        if(controller.signal.aborted)return;
        setJob(next);setError('');
        keepPolling=next.status==='queued'||next.status==='running';
      }catch(cause){
        if(controller.signal.aborted)return;
        setError(String(cause));
      }
      if(!controller.signal.aborted&&keepPolling)timer=setTimeout(()=>void poll(),1000);
    }
    timer=setTimeout(()=>void poll(),1000);
    return()=>{controller.abort();clearTimeout(timer);};
  },[job?.id,active]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!file)return;setSending(true);setError('');
    try{const form=new FormData();form.append('file',file);form.append('model',model);setJob(await request<Job>('/api/jobs',{method:'POST',body:form}));}
    catch(e){setError(e instanceof Error?e.message:'Upload failed');}finally{setSending(false);}
  }
  return <div className="studio"><header><a className="brand" href="/">MOZZART <span>STUDIO</span></a><span className="engine">{health}</span></header>
    <main><div className="intro"><p className="eyebrow">LOCAL AUDIO WORKSPACE / 01</p><h1>Hear every layer.</h1><p>Separate a recording, audition its stems, and take the WAV files into your next session.</p></div>
      <div className="workspace"><section className="source"><h2>Source recording</h2><p>Audio is sent to this local backend. No cloud model API is used.</p>
        <form onSubmit={e=>void submit(e)}><label className="upload">Choose audio<input type="file" accept=".wav,.mp3,.flac,.m4a" disabled={active||sending} onChange={e=>setFile(e.target.files?.[0]??null)}/><small>WAV, MP3, FLAC, M4A · maximum 100 MiB · 20 minutes</small></label>
          {file&&<p className="filename">{file.name} · {(file.size/1048576).toFixed(1)} MiB</p>}
          <label>Separation model<select value={model} disabled={active||sending} onChange={e=>setModel(e.target.value)}><option value="htdemucs">4 stems — vocals, drums, bass, other</option><option value="htdemucs_6s">6 stems — adds guitar and piano (unverified)</option></select></label>
          <button className="primary" disabled={!file||active||sending||file.size>104857600}>{sending?'Uploading…':active?'Processing…':'Separate stems'}</button>
        </form><p className="hint">First use downloads model weights. Processing speed depends on your local runtime. No estimated percentage is shown during inference.</p>
      </section><section className="results" aria-live="polite"><h2>Session outputs</h2>{!job?<div className="empty"><h3>No recording processed yet</h3><p>Your stems will appear here after a successful separation.</p></div>:<><p className="status">{job.status} / {job.stage}</p>{active&&<progress aria-label="Separation running"/>}{job.error&&<p role="alert" className="error">{job.error}</p>}{job.status==='succeeded'&&<><Multitrack key={job.id} files={job.files}/><h3>Downloads</h3><div className="downloads">{job.files.map(f=><a key={f.name} href={localFileUrl(f.url)} download>{f.name}</a>)}</div></>}</>}{error&&<p role="alert" className="error">{error}</p>}</section></div>
      <aside className="scope"><h2>Implementation preview</h2><p>URL imports, timestamped chord detection, guitar diagrams and MIDI are not available in this slice. The original chord rehearsal app remains unchanged at the repository root.</p></aside>
    </main><footer>MOZZART STUDIO · LOCAL-FIRST ENGINE · Your recordings, your responsibility.</footer></div>;
}

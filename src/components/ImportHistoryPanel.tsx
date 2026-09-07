import React, { useEffect, useRef, useState } from 'react';
import { Archive, CheckCircle2, Loader2, Play, Upload, XCircle } from 'lucide-react';

interface ImportRecord { id:string; name:string; original_filename?:string; status:string; total_rows:number; valid_rows:number; invalid_rows:number; duplicate_rows:number; suppressed_rows:number; imported_rows:number; processed_rows:number; list_id?:string|null; created_at:string; completed_at?:string|null; error_message?:string|null; }

export const ImportHistoryPanel: React.FC<{ authFetch:(url:string, options?:RequestInit)=>Promise<Response>; onUseAudience:(listId:string)=>void; }> = ({ authFetch, onUseAudience }) => {
  const [imports,setImports]=useState<ImportRecord[]>([]);
  const [uploading,setUploading]=useState(false);
  const [current,setCurrent]=useState<ImportRecord|null>(null);
  const [error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);

  const load=async()=>{try{const r=await authFetch('/api/imports');if(r.ok){const d=await r.json();setImports(d.imports||[]);}}catch(e:any){setError(e.message||'Failed to load import history');}};
  useEffect(()=>{load();},[]);

  const importFile=async(file:File)=>{
    setUploading(true);setError('');
    try{
      const start=await authFetch('/api/imports/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,filename:file.name})});
      const sd=await start.json(); if(!start.ok) throw new Error(sd.error||'Could not start import');
      let imp:ImportRecord=sd.import; setCurrent(imp);
      const chunkSize=4*1024*1024; let offset=0;
      while(offset<file.size){
        let end=Math.min(offset+chunkSize,file.size);
        if(end<file.size){const probe=await file.slice(offset,end).text();const cut=probe.lastIndexOf('\n');if(cut>0)end=offset+cut+1;}
        const chunk=await file.slice(offset,end).text();
        const r=await authFetch(`/api/imports/${imp.id}/chunk`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chunk})});
        const d=await r.json(); if(!r.ok) throw new Error(d.error||'Import chunk failed');
        imp={...imp,processed_rows:d.processedRows||imp.processed_rows,imported_rows:(imp.imported_rows||0)+(d.imported||0),valid_rows:(imp.valid_rows||0)+(d.valid||0),invalid_rows:(imp.invalid_rows||0)+(d.invalid||0),duplicate_rows:(imp.duplicate_rows||0)+(d.duplicate||0),suppressed_rows:(imp.suppressed_rows||0)+(d.suppressed||0)};setCurrent(imp);offset=end;
      }
      const done=await authFetch(`/api/imports/${imp.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const dd=await done.json();if(!done.ok)throw new Error(dd.error||'Import completion failed');
      setCurrent(dd.import); await load();
    }catch(e:any){setError(e.message||'Import failed');await load();}finally{setUploading(false);if(fileRef.current)fileRef.current.value='';}
  };

  return <section className="p-6 rounded-sm bg-[#0F0F0F] border border-white-10 space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold text-white flex items-center gap-2"><Archive className="w-4 h-4"/>Import History & Reusable Audiences</h2><p className="text-xs text-[#888888] mt-1">Imported files stay stored as reusable audiences. Uploads are chunked so multi-million-row files do not load into browser memory.</p></div>
      <button disabled={uploading} onClick={()=>fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white text-black text-xs font-semibold disabled:opacity-50"><Upload className="w-3.5 h-3.5"/>{uploading?'Importing…':'Import CSV / TXT'}</button>
      <input ref={fileRef} hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f);}}/>
    </div>
    {current&&<div className="p-4 rounded-sm bg-[#050505] border border-white-10"><div className="flex items-center justify-between text-xs"><span className="text-white font-medium">{current.original_filename||current.name}</span><span className="text-[#888888] font-mono">{current.status}</span></div><div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-white transition-all" style={{width:`${current.total_rows?Math.min(100,(current.processed_rows/current.total_rows)*100):uploading?8:100}%`}}/></div><div className="mt-2 text-[10px] text-[#888888] font-mono">Processed: {current.processed_rows||0} · Imported: {current.imported_rows||0} · Duplicates: {current.duplicate_rows||0} · Suppressed: {current.suppressed_rows||0} · Invalid: {current.invalid_rows||0}</div></div>}
    {error&&<div className="text-xs text-red-400 flex items-center gap-2"><XCircle className="w-3.5 h-3.5"/>{error}</div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-white-10 text-[10px] uppercase tracking-[0.12em] text-[#888888]"><th className="py-2">Audience</th><th>Status</th><th>Rows</th><th>Imported</th><th>Created</th><th></th></tr></thead><tbody className="divide-y divide-white/5 font-mono text-[11px]">{imports.map(i=><tr key={i.id} className="hover:bg-white/5"><td className="py-3 text-white"><div>{i.name}</div><div className="text-[10px] text-[#666]">{i.original_filename}</div></td><td className="py-3"><span className="inline-flex items-center gap-1">{i.status==='COMPLETED'?<CheckCircle2 className="w-3 h-3"/>:i.status==='PROCESSING'?<Loader2 className="w-3 h-3 animate-spin"/>:<span className="w-2 h-2 rounded-full bg-white/30"/>}{i.status}</span></td><td className="py-3 text-[#aaa]">{i.total_rows||i.processed_rows||0}</td><td className="py-3 text-[#aaa]">{i.imported_rows||0}</td><td className="py-3 text-[#777]">{new Date(i.created_at).toLocaleString()}</td><td className="py-3 text-right">{i.list_id&&i.status==='COMPLETED'&&<button onClick={()=>onUseAudience(i.list_id!)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-black rounded-sm text-[10px] font-semibold"><Play className="w-3 h-3"/>Use audience</button>}</td></tr>)}{!imports.length&&<tr><td colSpan={6} className="py-8 text-center text-[#666]">No imports yet.</td></tr>}</tbody></table></div>
  </section>;
};

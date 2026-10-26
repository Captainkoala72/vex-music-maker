'use client';
import { useId, useState } from 'react';
import { Check, Disc3, Pencil, X } from 'lucide-react';
import { validateSongTitle } from '@/lib/titles';

export function SongName({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState('');
  if (!editing) return <div className="song-title"><Disc3 size={22}/><h3>{title}</h3><button className="rename-button" aria-label={`Rename ${title}`} title="Rename song" onClick={() => { setDraft(title); setError(''); setEditing(true); }}><Pencil size={15}/></button></div>;
  return <form className="rename-form" onSubmit={e => { e.preventDefault(); try { onRename(validateSongTitle(draft)); setEditing(false); } catch (e) { setError((e as Error).message); } }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}>
    <label className="input-label" htmlFor={inputId}>SONG NAME</label>
    <div className="rename-controls"><input id={inputId} autoFocus aria-label={`New name for ${title}`} value={draft} maxLength={100} onChange={e => { setDraft(e.target.value); setError(''); }}/><button className="rename-save" type="submit" aria-label="Save song name"><Check size={17}/></button><button type="button" aria-label="Cancel rename" onClick={() => setEditing(false)}><X size={17}/></button></div>
    {error && <p className="rename-error" role="alert">{error}</p>}
  </form>;
}

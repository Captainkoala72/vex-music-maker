'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Disc3, Globe2, LoaderCircle, Music2, Plus, RotateCcw, Search, Settings2, Shuffle, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { MODEL_IDS, MODELS, isModel, normalizeSettings, validatePrompt, type ModelId, type PromptMode, type Settings, type Field } from '@/lib/models';
import { CATEGORIES, PRESETS, type Preset } from '@/lib/presets';
import { readSongs, writeSongs, type Song } from '@/lib/storage';

async function api(path: string, body?: unknown) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
  return data;
}
function CourtMark({ small = false }: { small?: boolean }) {
  return <svg width={small ? 28 : 42} height={small ? 28 : 42} viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M4 4h36v36H4zM4 22h36M14 4v36M30 4v36M14 13h16M14 31h16M22 13v18" stroke="currentColor" strokeWidth="2"/></svg>;
}
function Pattern({ index = 0 }: { index?: number }) { return <div className={`pattern pattern-${index % 6}`} aria-hidden="true"><i/><i/><i/><i/></div>; }
function Waveform() { return <div className="waveform" aria-hidden="true">{Array.from({ length: 54 }, (_, i) => <i key={i} style={{ height: `${15 + (Math.sin(i * 1.6) + 1) * 17 + (Math.sin(i * .43) + 1) * 14}%` }}/>)}</div>; }

export default function Studio() {
  const [model, setModel] = useState<ModelId>('minimax-music-3-0');
  const [settingsByModel, setSettingsByModel] = useState<Record<ModelId, Settings>>(() => Object.fromEntries(MODEL_IDS.map(id => [id, { ...MODELS[id].defaults }])) as Record<ModelId, Settings>);
  const [mode, setMode] = useState<PromptMode>('preset');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [description, setDescription] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [title, setTitle] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMode, setWebhookMode] = useState('terminal');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [config, setConfig] = useState<{ pixazo: boolean; zai: boolean } | null>(null);
  const [category, setCategory] = useState('All styles');
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState<string[]>([]);
  const [help, setHelp] = useState(false);
  const songsRef = useRef(songs);
  const pollingRef = useRef(new Set<string>());
  const submissionRef = useRef(false);
  const settings = settingsByModel[model];
  const selected = PRESETS.find(p => p.id === presetId) || PRESETS[0];
  const savedCount = songs.filter(s => !s.downloaded).length;
  const completedCount = songs.filter(s => s.status === 'COMPLETED').length;
  const pendingCount = songs.filter(s => s.status === 'QUEUED' || s.status === 'PROCESSING').length;
  const filtered = PRESETS.filter(p => (category === 'All styles' || p.category === category) && `${p.name} ${p.genre} ${p.mood}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    try { setSongs(readSongs().filter(s => isModel(s.model))); } catch { setStorageError('Saved tracks could not be read. Keep this tab open and download new tracks before leaving.'); }
    setLoaded(true);
    api('/api/config').then(setConfig).catch(() => setError('The studio could not check its API configuration. Refresh to try again.'));
  }, []);
  useEffect(() => {
    songsRef.current = songs;
    if (!loaded) return;
    try { writeSongs(songs); setStorageError(''); } catch { setStorageError('Browser storage is full or unavailable. Download your tracks before closing this tab; new results may not survive a refresh.'); }
  }, [songs, loaded]);
  useEffect(() => {
    if (!loaded) return;
    let active = true;
    const poll = () => {
      songsRef.current.filter(s => s.ticket && ['QUEUED', 'PROCESSING'].includes(s.status)).forEach(async song => {
        if (pollingRef.current.has(song.id)) return;
        pollingRef.current.add(song.id);
        try {
          const result = await api(`/api/status?ticket=${encodeURIComponent(song.ticket!)}`);
          if (active) setSongs(prev => prev.map(s => s.id === song.id ? { ...s, ...result, error: result.error } : s));
        } catch (e) {
          if (active) setSongs(prev => prev.map(s => s.id === song.id ? { ...s, error: `Status check delayed: ${(e as Error).message} Retrying automatically.` } : s));
        } finally { pollingRef.current.delete(song.id); }
      });
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => { active = false; clearInterval(interval); };
  }, [loaded]);

  function updateSetting(key: string, value: string | number | boolean) {
    setSettingsByModel(prev => ({ ...prev, [model]: { ...prev[model], [key]: value, ...(key === 'is_instrumental' && value === true ? { lyrics_optimizer: false, lyrics: '' } : {}) } }));
  }
  function selectPreset(preset: Preset, scroll = false) {
    setPresetId(preset.id); setPrompt(preset.prompt); setMode('preset'); setAiReady(false); setError('');
    if (scroll) { document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setNotice(`${preset.name} loaded into the studio.`); }
  }
  async function writePrompt() {
    if (!description.trim()) throw new Error('Describe a genre, mood, or style first.');
    if (config && !config.zai) throw new Error('Add ZAI_API_KEY in Vercel to use the AI prompt writer. Presets and direct prompts only need PIXAZO_API_KEY.');
    const result = await api('/api/prompt', { model, description, webSearch, instrumental: model !== 'minimax-music-3-0' || settings.is_instrumental });
    setPrompt(result.prompt); setAiReady(true);
    return result.prompt as string;
  }
  async function previewPrompt() {
    if (submissionRef.current) return;
    submissionRef.current = true; setBusy('Writing your prompt'); setError('');
    try { await writePrompt(); setNotice('Your AI prompt is ready. Review it, then generate a track.'); } catch (e) { setError((e as Error).message); } finally { setBusy(''); submissionRef.current = false; }
  }
  async function submitTrack(snapshot?: Song) {
    if (submissionRef.current) return;
    submissionRef.current = true; setError('');
    try {
      if (config && !config.pixazo) throw new Error('Add PIXAZO_API_KEY in your Vercel environment variables to start generating tracks.');
      const useModel = snapshot?.model || model;
      const useSettings = { ...(snapshot?.settings || settings) };
      normalizeSettings(useModel, useSettings);
      let usePrompt = snapshot?.prompt || prompt;
      if (!snapshot && mode === 'ai' && !aiReady) { setBusy('Writing your prompt'); usePrompt = await writePrompt(); }
      validatePrompt(useModel, usePrompt);
      setBusy('Sending to Pixazo');
      const songTitle = snapshot ? `${snapshot.title.replace(/ · remake$/, '')} · remake` : title.trim() || (mode === 'preset' ? selected.name : mode === 'ai' ? description.slice(0, 55) : 'Untitled session');
      const result = await api('/api/generate', { model: useModel, prompt: usePrompt, settings: useSettings, webhookUrl: snapshot?.webhookUrl ?? webhookUrl, webhookMode: snapshot?.webhookMode ?? webhookMode });
      const song: Song = { id: crypto.randomUUID(), title: songTitle, model: useModel, prompt: usePrompt, settings: useSettings, mode: snapshot?.mode || mode, presetId: snapshot?.presetId || presetId, description: snapshot?.description ?? description, webSearch: snapshot?.webSearch ?? webSearch, webhookUrl: snapshot?.webhookUrl ?? webhookUrl, webhookMode: snapshot?.webhookMode ?? webhookMode, createdAt: new Date().toISOString(), ...result };
      setSongs(prev => [song, ...prev]);
      setNotice(result.status === 'COMPLETED' ? 'Your track is ready in Your Crate.' : 'Track queued. You can create another while Pixazo works.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); submissionRef.current = false; }
  }
  function remix(song: Song) {
    setModel(song.model); setSettingsByModel(prev => ({ ...prev, [song.model]: { ...MODELS[song.model].defaults, ...song.settings } }));
    setPrompt(song.prompt); setMode(song.mode); setPresetId(song.presetId || PRESETS[0].id); setDescription(song.description || ''); setWebSearch(song.webSearch || false); setAiReady(true); setTitle(song.title.replace(/ · remix$/, '') + ' · remix'); setWebhookUrl(song.webhookUrl || ''); setWebhookMode(song.webhookMode || 'terminal'); setError('');
    setNotice('All track settings loaded. Adjust anything and generate your remix.'); document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' });
  }
  async function download(song: Song) {
    setDownloading(prev => [...prev, song.id]); setError('');
    try {
      const url = song.audioUrl?.startsWith('data:') ? song.audioUrl : `/api/download?ticket=${encodeURIComponent(song.downloadTicket || '')}&name=${encodeURIComponent(song.title)}`;
      const response = await fetch(url!);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'The audio could not be downloaded.'); }
      const blob = await response.blob();
      if (!blob.size) throw new Error('The audio file is empty. Your saved track has been kept.');
      const ext = String(song.settings.output_format || song.settings.format || 'mp3');
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = objectUrl; link.download = `${song.title.replace(/[^a-zA-Z0-9_-]/g, '-')}.${ext}`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, downloaded: true } : s));
      setNotice('Download started. This track is removed from browser storage and stays visible for this session.');
    } catch (e) { setError((e as Error).message); } finally { setDownloading(prev => prev.filter(id => id !== song.id)); }
  }
  const changeMode = (next: PromptMode) => { setMode(next); setError(''); if (next === 'ai' && !aiReady) setPrompt(''); if (next === 'preset') setPrompt(selected.prompt); };

  return <>
    <header className="site-header"><a className="brand" href="#" aria-label="VEX home"><span className="brand-mark"><CourtMark small/></span>VEX<span className="brand-sub">MUSIC<br/>MAKER</span></a><nav aria-label="Main navigation"><a className="active" href="#studio">Studio <span>01</span></a><a href="#presets">Preset library <span>02</span></a><a href="#tracks">Your crate <b>{String(savedCount).padStart(2, '0')}</b></a></nav><button className="header-help" onClick={() => setHelp(true)} aria-label="Open setup and help"><CircleHelp size={19}/><span>Setup & help</span></button></header>

    <main>
      <section className="hero" aria-labelledby="hero-heading"><div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> THE TENNIS SOUNDTRACK LAB <span className="hero-edition">VOL. 001 / INSTRUMENTALS</span></div><h1 id="hero-heading">SOUND<br/>IN PLAY<span className="headline-period">.</span></h1><div className="hero-bottom"><p>Fresh sounds. Endless rallies.<br/>Make the soundtrack to your tennis universe.</p><a className="hero-link" href="#studio">LET’S MAKE A TRACK <ArrowDown size={18}/></a></div></div><div className="hero-art"><div className="photo-pill"><img src="/tennis-court.jpg" alt="Overhead view of a sunlit tennis court"/></div><span className="red-orbit" aria-hidden="true"/><div className="hero-court"><CourtMark/></div><span className="art-label">A NEW GROOVE.<br/>EVERY GAME.</span><span className="hero-cross" aria-hidden="true">+</span></div></section>

      <div className="ticker" aria-hidden="true"><span>BUILT FOR THE GAME</span><span>✳</span><span>24 ORIGINAL PRESETS</span><span>✳</span><span>3 MUSIC MODELS</span><span>✳</span><span>INFINITE DIRECTIONS</span><span>✳</span><span>PRESS PLAY. FIND YOUR GROOVE.</span></div>

      <section className="studio-section section-wrap" id="studio" aria-labelledby="studio-title"><div className="section-heading"><div><span className="section-kicker">01 / THE STUDIO</span><h2 id="studio-title">MAKE SOME NOISE<span className="red-text">.</span></h2></div><span className="section-note">YOUR NEXT UNLOCK STARTS HERE <ArrowDownRight/></span></div>
        <div className="studio-grid"><div className="studio-card">
          <div className="card-top"><span><span className="mini-dot"/> NEW SESSION</span><span>INSTRUMENTALS, ON REPEAT.</span></div>
          <div className="form-section"><div className="field-heading"><h3><span>01</span> CHOOSE YOUR ENGINE</h3><span>POWERED BY PIXAZO <ArrowUpRight size={12}/></span></div><div className="model-options" role="radiogroup" aria-label="Music model">{MODEL_IDS.map((id, i) => <button key={id} role="radio" aria-checked={model === id} className={`model-option ${model === id ? 'selected' : ''}`} onClick={() => { setModel(id); setError(''); }}><span className="model-number">0{i + 1}<i>{model === id && <Check size={10}/>}</i></span><strong>{MODELS[id].name}</strong><small>{MODELS[id].caption}</small></button>)}</div></div>
          <div className="form-section prompt-section"><div className="field-heading"><h3><span>02</span> FIND YOUR DIRECTION</h3></div><div className="mode-tabs" role="tablist" aria-label="Prompt source">{([{ id: 'preset', icon: Disc3, label: 'Pick a preset' }, { id: 'ai', icon: Sparkles, label: 'Describe a vibe' }, { id: 'direct', icon: SlidersHorizontal, label: 'Write a prompt' }] as const).map(tab => <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={mode === tab.id} aria-controls={`panel-${mode}`} className={mode === tab.id ? 'selected' : ''} onClick={() => changeMode(tab.id)}><tab.icon size={15}/>{tab.label}</button>)}</div>
            <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
              {mode === 'preset' && <><div className="preset-select-row"><div className="field-grow"><label className="input-label" htmlFor="preset-select">THE STARTING LINEUP</label><div className="select-wrap"><select id="preset-select" value={presetId} onChange={e => selectPreset(PRESETS.find(p => p.id === e.target.value)!)}>{PRESETS.map((p, i) => <option key={p.id} value={p.id}>{String(i + 1).padStart(2, '0')} — {p.name} / {p.genre}</option>)}</select><ChevronDown size={16}/></div></div><a className="square-button" href="#presets" aria-label="Browse all presets"><ArrowUpRight size={22}/></a></div><div className="prompt-meta"><span>{selected.genre}</span><span>{selected.bpm} BPM</span><span>LOOP-MINDED</span></div></>}
              {mode === 'ai' && <div className="ai-description"><label className="input-label" htmlFor="description">TELL US WHAT YOU’RE HEARING</label><textarea id="description" value={description} maxLength={4000} placeholder="A Japanese city-pop groove for a rooftop court at sunset. Warm keys, a bouncy bassline, a little nostalgia…" onChange={e => { setDescription(e.target.value); setAiReady(false); }}/><div className="ai-toolbar"><span className="ai-model-label"><Sparkles size={13}/> GLM 5.3 FLASH <b>HIGH REASONING</b></span><label className="search-toggle"><Globe2 size={14}/><span>Web search</span><input type="checkbox" checked={webSearch} onChange={e => { setWebSearch(e.target.checked); setAiReady(false); }}/><span className="switch"/></label></div><button className="outline-button write-button" disabled={!!busy || !description.trim()} onClick={previewPrompt}><Sparkles size={14}/>{busy === 'Writing your prompt' ? 'Writing…' : aiReady ? 'Rewrite prompt' : 'Write my prompt'}<ArrowRight size={15}/></button></div>}
              {(mode !== 'ai' || aiReady) && <div className="prompt-input"><div className="input-label-row"><label className="input-label" htmlFor="music-prompt">{mode === 'preset' ? 'READY-MADE MUSIC PROMPT' : mode === 'ai' ? 'AI PROMPT · REVIEW & EDIT' : 'YOUR MUSIC PROMPT'}</label><span className={prompt.length > MODELS[model].maxPrompt ? 'red-text' : ''}>{prompt.length} / {MODELS[model].maxPrompt.toLocaleString()}</span></div><textarea id="music-prompt" className="music-prompt" value={prompt} readOnly={mode === 'preset'} maxLength={MODELS[model].maxPrompt} placeholder="Describe the genre, tempo, instruments, and feeling. Include no vocals and a loop-friendly ending for instrumental game music." onChange={e => setPrompt(e.target.value)}/>{mode === 'preset' && <button className="text-button" onClick={() => setMode('direct')}>Make this prompt your own <ArrowUpRight size={13}/></button>}</div>}
            </div>
          </div>
          <div className="settings-section"><details><summary><span><Settings2 size={17}/><strong>MODEL SETTINGS</strong></span><span className="settings-summary">{model === 'minimax-music-3-0' ? `${String(settings.format).toUpperCase()} / ${Number(settings.sample_rate) / 1000} kHz` : model === 'mureka-instrumental' ? String(settings.model).replace('mureka-', 'VERSION ') : `${settings.duration}s / ${String(settings.output_format).toUpperCase()}`}<Plus size={16}/></span></summary><div className="settings-body"><div className="settings-intro"><p>{model === 'stable-audio-3-small-music-text-to-audio' ? 'Fine-tune every supported text-to-audio control.' : 'The model determines track length. Duration and seed controls are not available for this engine.'}</p><a href={MODELS[model].docs} target="_blank" rel="noreferrer">Model docs <ArrowUpRight size={12}/></a></div><div className="settings-grid">{MODELS[model].fields.map(field => <SettingControl key={field.key} field={field} value={settings[field.key]} disabled={model === 'minimax-music-3-0' && (field.key === 'lyrics_optimizer' && !!settings.is_instrumental || field.key === 'lyrics' && (!!settings.is_instrumental || !!settings.lyrics_optimizer))} onChange={value => updateSetting(field.key, value)}/>)}</div><details className="webhook-details"><summary>OPTIONAL WEBHOOK <ChevronDown size={14}/></summary><label className="input-label" htmlFor="webhook">CALLBACK URL</label><input id="webhook" type="url" value={webhookUrl} placeholder="https://your-server.com/webhook" onChange={e => setWebhookUrl(e.target.value)}/>{model !== 'stable-audio-3-small-music-text-to-audio' && <div className="webhook-mode"><label className="input-label" htmlFor="webhook-mode">CALLBACK MODE</label><select id="webhook-mode" value={webhookMode} onChange={e => setWebhookMode(e.target.value)}><option value="terminal">Terminal — completion / error</option><option value="sync">Sync — per poll + terminal</option></select></div>}<p className="field-hint">Pixazo can notify your HTTPS endpoint. This studio continues polling to update your crate.</p></details></div></details></div>
          <div className="generate-section"><div className="title-field"><label className="input-label" htmlFor="track-title">TRACK NAME <span>OPTIONAL</span></label><input id="track-title" value={title} maxLength={100} placeholder={mode === 'preset' ? selected.name : 'Name this session'} onChange={e => setTitle(e.target.value)}/></div><button className="generate-button" disabled={!!busy || !loaded} onClick={() => submitTrack()}>{busy ? <LoaderCircle className="spin" size={20}/> : <Sparkles size={20}/>}<span>{busy || 'GENERATE TRACK'}</span>{!busy && <ArrowUpRight size={23}/>}</button><div className="generate-foot"><span>ONE REQUEST. ONE NEW DIRECTION.</span><span>API USAGE IS BILLED BY PIXAZO.</span></div></div>
        </div>

        <aside className="session-rail"><div className="session-art"><div className="session-art-top"><span>ON THE MOODBOARD</span><span>↗ 01–24</span></div><div className="record"><div className="record-center"><CourtMark small/><span>VEX / 33⅓</span></div></div><div className="session-art-bottom"><span>ORIGINAL SOUNDS.<br/>UNLIMITED POTENTIAL.</span><span className="art-plus">✳</span></div></div><div className="session-info"><span className="section-kicker">{mode === 'preset' ? `PRESET ${String(PRESETS.indexOf(selected) + 1).padStart(2, '0')} / 24` : 'YOUR OWN DIRECTION'}</span><h3>{mode === 'preset' ? selected.name : mode === 'ai' ? 'IMAGINE IT. HEAR IT.' : 'STRAIGHT FROM YOU.'}</h3><p>{mode === 'preset' ? selected.genre : mode === 'ai' ? 'Your idea, shaped into a detailed music prompt by GLM 5.3 Flash.' : 'Your exact words go straight to the selected Pixazo music model.'}</p><div className="session-stats"><span><small>{mode === 'preset' ? 'TEMPO' : 'PROMPT'}</small><strong>{mode === 'preset' ? selected.bpm : 'YOU'}<i>{mode === 'preset' ? 'BPM' : 'DIRECT'}</i></strong></span><span><small>OUTPUT</small><strong>{model === 'minimax-music-3-0' && !settings.is_instrumental ? 'VOCAL' : 'INST.'}<i>AUDIO</i></strong></span></div></div><div className="crate-preview"><div><Disc3 size={20}/><h3>YOUR CRATE</h3><span>{String(savedCount).padStart(2, '0')}</span></div><p>{pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'track is' : 'tracks are'} in the making. Keep exploring while the music comes together.` : completedCount ? 'Fresh tracks are ready. Listen, download, or take them in a new direction.' : 'A home for your next favorite. Generated tracks will land here, ready to play.'}</p><a href="#tracks">{completedCount || pendingCount ? 'OPEN YOUR CRATE' : 'WAITING FOR YOUR FIRST TRACK'}<ArrowRight size={15}/></a></div><div className="rail-photo"><img src="/tennis-court.jpg" alt="Tennis player serving on a clay court"/><span>COURT / SOUND / CULTURE</span></div></aside></div>
        {config && !config.pixazo && <div className="setup-banner"><span className="mini-dot"/><p><strong>YOUR STUDIO IS READY FOR ITS KEYS.</strong> Add <code>PIXAZO_API_KEY</code> and <code>ZAI_API_KEY</code> in Vercel to start making music.</p><button onClick={() => setHelp(true)}>SETUP GUIDE <ArrowUpRight size={15}/></button></div>}
        {error && <div className="message error-message" role="alert"><p>{error}</p><button aria-label="Dismiss error" onClick={() => setError('')}><X size={18}/></button></div>}
        {storageError && <div className="message error-message" role="alert"><p>{storageError}</p></div>}
      </section>

      <section className="preset-section section-wrap" id="presets" aria-labelledby="presets-title"><div className="section-heading"><div><span className="section-kicker">02 / THE STARTING LINEUP</span><h2 id="presets-title">PICK YOUR FLAVOR<span className="red-text">.</span></h2></div><p>24 ready-to-play directions.<br/>Find a feeling. Make it yours.</p></div><div className="library-toolbar"><div className="category-filters" aria-label="Filter presets">{CATEGORIES.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}{c === 'All styles' && <span>24</span>}</button>)}</div><label className="preset-search"><Search size={16}/><input aria-label="Search presets" placeholder="Find your groove…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear preset search" onClick={() => setQuery('')}><X size={14}/></button>}</label></div><div className="preset-grid">{filtered.map(p => <button key={p.id} className={`preset-card ${presetId === p.id && mode === 'preset' ? 'selected' : ''}`} onClick={() => selectPreset(p, true)}><div className="preset-art"><Pattern index={p.pattern}/><span className="preset-number">{String(PRESETS.indexOf(p) + 1).padStart(2, '0')}</span><span className="preset-card-arrow">{presetId === p.id && mode === 'preset' ? <Check size={19}/> : <ArrowUpRight size={20}/>}</span></div><div className="preset-card-info"><span className="preset-genre">{p.genre}</span><h3>{p.name}</h3><div><span>{p.mood}</span><span>{p.bpm} BPM</span></div></div></button>)}</div>{!filtered.length && <div className="no-results"><Search size={28}/><h3>NO MATCH THIS TIME.</h3><p>Try another genre or clear your filters.</p><button className="outline-button" onClick={() => { setQuery(''); setCategory('All styles'); }}>Show all presets</button></div>}</section>

      <section className="tracks-section section-wrap" id="tracks" aria-labelledby="tracks-title"><div className="section-heading"><div><span className="section-kicker">03 / FRESH FROM THE STUDIO</span><h2 id="tracks-title">YOUR CRATE<span className="red-text">.</span><span className="heading-count">{String(savedCount).padStart(2, '0')}</span></h2></div><p>Listen. Keep it. Make it again.<br/>Only undownloaded tracks stay saved here.</p></div>{songs.length === 0 ? <div className="empty-crate"><div className="empty-icon"><Music2 size={32}/><span>+</span></div><h3>EVERY SOUNDTRACK<br/>STARTS SOMEWHERE.</h3><p>Pick a preset or follow your own idea.<br/>Your first track is one good groove away.</p><a href="#studio" className="outline-button">MAKE YOUR FIRST TRACK <ArrowUpRight size={16}/></a><span className="empty-caption">NO TRACKS YET / ALL POTENTIAL</span></div> : <div className="song-grid">{songs.map((song, i) => <article className="song-card" key={song.id}><div className="song-card-top"><span>TAKE {String(songs.length - i).padStart(2, '0')} / {MODELS[song.model].short.toUpperCase()}</span><span className={`song-status ${song.status === 'ERROR' ? 'failed' : ''}`}>{song.status === 'COMPLETED' ? song.downloaded ? <><Check size={12}/> DOWNLOADED</> : <><span className="mini-dot"/> READY TO PLAY</> : song.status === 'ERROR' ? 'GENERATION FAILED' : <><LoaderCircle size={12} className="spin"/>{song.status === 'QUEUED' ? 'IN THE QUEUE' : 'MAKING MUSIC'}</>}</span></div><div className="song-main"><div className="song-title"><Disc3 size={22}/><h3>{song.title}</h3></div><span className="song-date">{new Date(song.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><Waveform/>{song.audioUrl && <audio controls preload="none" src={song.audioUrl} aria-label={`Play ${song.title}`} onPlay={e => { document.querySelectorAll('audio').forEach(a => { if (a !== e.currentTarget) a.pause(); }); }}/>} {song.status !== 'COMPLETED' && <p className="song-waiting">{song.error || 'Pixazo is building your track. Progress checks run every 10 seconds and resume when you reopen this studio.'}</p>}<details className="song-details"><summary>VIEW PROMPT & SETTINGS <ChevronDown size={12}/></summary><p>{song.prompt}</p><dl>{Object.entries(song.settings).filter(([,v]) => v !== '').map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl></details></div><div className="song-actions"><button disabled={song.status !== 'COMPLETED' || downloading.includes(song.id)} onClick={() => download(song)}>{downloading.includes(song.id) ? <LoaderCircle size={15} className="spin"/> : <ArrowDownToLine size={15}/>} {downloading.includes(song.id) ? 'Saving…' : 'Download'}</button><button disabled={!!busy} onClick={() => submitTrack(song)}><RotateCcw size={15}/>Remake</button><button disabled={!!busy} onClick={() => remix(song)}><Shuffle size={15}/>Remix</button></div></article>)}</div>}<div className="storage-note"><span><Disc3 size={15}/> SAVED IN THIS BROWSER</span><p>Undownloaded track records and their audio links persist in localStorage. Download to keep the audio file; provider links can expire. Downloaded tracks leave storage and remain visible until you close or refresh this session.</p></div></section>
    </main>
    <footer><a className="brand" href="#"><CourtMark small/>VEX</a><p>GOOD GAMES DESERVE GOOD MUSIC.</p><span>MADE FOR THE NEXT RALLY. <ArrowUpRight size={16}/></span></footer>
    {notice && <div className="toast" role="status"><Check size={18}/><p>{notice}</p><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={17}/></button></div>}
    {help && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setHelp(false); }}><dialog open className="help-modal" aria-modal="true" aria-labelledby="help-title" onKeyDown={e => { if (e.key === 'Escape') setHelp(false); if (e.key === 'Tab') { const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')); const first = controls[0], last = controls[controls.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}><div className="card-top"><span>BEFORE THE FIRST SERVE</span><button autoFocus aria-label="Close setup guide" onClick={() => setHelp(false)}><X size={20}/></button></div><div className="help-content"><span className="section-kicker">THE QUICK SETUP</span><h2 id="help-title">PLUG IN.<br/>PRESS PLAY.</h2><ol><li>Import <strong>vex-music-maker</strong> into Vercel. The framework is Next.js.</li><li>Add <code>PIXAZO_API_KEY</code> for all music models and <code>ZAI_API_KEY</code> for the optional AI prompt writer in Project Settings → Environment Variables.</li><li>Deploy or redeploy after adding the keys. Keys stay on the server and are never saved in this browser.</li></ol><p><strong>Three ways in:</strong> use one of 24 presets, describe a vibe for GLM 5.3 Flash, or send your own exact prompt. Web search is optional and only available in the AI mode.</p><p><strong>Keep your favorites:</strong> Download saves an audio file and removes its browser record. Remake repeats its exact prompt, model, and settings. Remix loads everything back into the studio for editing.</p><p className="field-hint">Stable Audio offers exact duration controls. MiniMax and Mureka choose track length. Generation requests are billed by Pixazo; AI writing and optional search use your zAI account.</p><button className="generate-button" onClick={() => setHelp(false)}>BACK TO THE STUDIO <ArrowRight size={18}/></button></div></dialog></div>}
  </>;
}
function ArrowDownRight() { return <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M5 5l20 20M8 25h17V8" stroke="currentColor" strokeWidth="2"/></svg>; }
function SettingControl({ field, value, disabled, onChange }: { field: Field; value: string | number | boolean; disabled?: boolean; onChange: (v: string | number | boolean) => void }) {
  const id = `setting-${field.key}`;
  return <div className={`setting-field ${field.type === 'textarea' || field.type === 'toggle' ? 'full-width' : ''} ${disabled ? 'disabled-field' : ''}`}>{field.type === 'toggle' ? <label className="setting-toggle" htmlFor={id}><span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span><input id={id} type="checkbox" checked={!!value} disabled={disabled} onChange={e => onChange(e.target.checked)}/><span className="switch"/></label> : <><label className="input-label" htmlFor={id}>{field.label}</label>{field.type === 'select' ? <div className="select-wrap"><select id={id} value={String(value)} disabled={disabled} onChange={e => onChange(typeof field.options![0] === 'number' ? Number(e.target.value) : e.target.value)}>{field.options?.map(option => <option key={option} value={option}>{typeof option === 'string' ? option.toUpperCase() : option.toLocaleString()}</option>)}</select><ChevronDown size={14}/></div> : field.type === 'textarea' ? <textarea id={id} value={String(value)} disabled={disabled} maxLength={field.max} rows={3} onChange={e => onChange(e.target.value)}/> : <input id={id} type={field.type} value={String(value)} disabled={disabled} min={field.min} max={field.max} step={field.step} placeholder={field.optional ? 'Random' : ''} onChange={e => onChange(field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}/>} {field.hint && <p className="field-hint">{field.hint}</p>}</>}</div>;
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Cpu, Music, Radio, Wrench, Lock, Unlock,
  Trash2, Plus, Search, ExternalLink, Play, Pause, X,
  Check, RefreshCw, Sliders, Shield, MessageSquare,
  Activity, Disc, ArrowUpRight, Github, Instagram, Send
} from 'lucide-react';

// Dynamically picks up https://cli.4helio.xyz/api from build environment
const API_BASE = import.meta.env.VITE_API_URL || 'https://cli.4helio.xyz/api';

export default function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin Auth & Modal
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinErr, setPinErr] = useState(false);
  const [adminTab, setAdminTab] = useState('hero');

  // Audio State
  const [currentSongId, setCurrentSongId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Song iTunes API Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // New Log Entry State
  const [newLogEntry, setNewLogEntry] = useState('');

  // Fetch DB Data from cli.4helio.xyz
  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/data`);
      const data = await res.json();
      setDb(data);
    } catch (e) {
      console.error("Failed to fetch from cli.4helio.xyz", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Unlock Admin
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin })
      });
      if (res.ok) {
        setIsUnlocked(true);
        setPinErr(false);
      } else {
        setPinErr(true);
      }
    } catch (err) {
      setPinErr(true);
    }
  };

  // Generic Admin PUT Request
  const updateResource = async (endpoint, payload) => {
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      alert('Failed to update backend on cli.4helio.xyz');
    }
  };

  // iTunes API Search
  const searchITunes = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=8`);
      const data = await res.json();
      const formatted = data.results.map(item => ({
        id: `itunes-${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        albumArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '',
        previewUrl: item.previewUrl,
        note: 'Added from iTunes'
      }));
      setSearchResults(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const addSong = async (song) => {
    await fetch(`${API_BASE}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify(song)
    });
    fetchData();
  };

  const deleteSong = async (id) => {
    await fetch(`${API_BASE}/songs/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': adminPin }
    });
    fetchData();
  };

  const addLog = async (e) => {
    e.preventDefault();
    if (!newLogEntry.trim()) return;
    await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify({ entry: newLogEntry })
    });
    setNewLogEntry('');
    fetchData();
  };

  // Audio Toggle
  const togglePlay = (song) => {
    if (!song.previewUrl) return;
    if (currentSongId === song.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(song.previewUrl);
      audioRef.current = audio;
      audio.play();
      setCurrentSongId(song.id);
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  if (loading || !db) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 font-mono flex items-center justify-center text-xs">
        <Activity className="w-4 h-4 animate-spin text-amber-500 mr-2" />
        CONNECTING TO CLI.4HELIO.XYZ...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111110] text-neutral-200 font-sans selection:bg-amber-500 selection:text-black">

      {/* Dynamic Announcement Banner */}
      {db.banner.enabled && (
        <div className="bg-amber-500 text-neutral-950 px-4 py-2 text-xs font-mono font-bold flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="inline-block w-2 h-2 bg-black animate-ping rounded-full"></span>
            <span className="truncate">{db.banner.text}</span>
          </div>
          {db.banner.linkUrl && (
            <a href={db.banner.linkUrl} className="underline hover:text-white shrink-0 ml-4">
              {db.banner.linkText || 'Open'} →
            </a>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Top Header Navigation */}
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-amber-500 text-sm">
              HL
            </div>
            <div>
              <h1 className="font-bold text-sm text-neutral-100 tracking-wide">{db.hero.name}</h1>
              <p className="text-xs text-neutral-500 font-mono">{db.hero.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <a href="#workbench" className="text-neutral-400 hover:text-amber-400 transition-colors">/workbench</a>
            <a href="#tapes" className="text-neutral-400 hover:text-amber-400 transition-colors">/audio</a>
            <a href="#logs" className="text-neutral-400 hover:text-amber-400 transition-colors">/logs</a>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-amber-500 text-neutral-300 text-xs font-mono flex items-center gap-1.5 transition-all"
            >
              <Wrench className="w-3 h-3 text-amber-500" />
              <span>[Admin]</span>
            </button>
          </div>
        </header>

        {/* HERO / PERSONAL STATUS */}
        <section className="grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              {db.hero.status}
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-100 tracking-tight leading-snug">
              Casual software maker, hardware tinkerer & music addict.
            </h2>

            <p className="text-neutral-400 text-sm leading-relaxed">
              {db.hero.bio}
            </p>

            {/* Direct Social Handles */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
              {[
                { name: "Instagram", handle: "@4helio", href: "https://instagram.com/4helio" },
                { name: "Threads", handle: "@4helio", href: "https://threads.net/@4helio" },
                { name: "TikTok", handle: "@edubex", href: "https://tiktok.com/@edubex" },
                { name: "GitHub", handle: "NullClock", href: "https://github.com/NullClock" },
                { name: "WhatsApp", handle: "+12154105236", href: "https://wa.me/12154105236" },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-all flex items-center gap-1"
                >
                  <span>{s.name}</span>
                  <span className="text-neutral-500">{s.handle}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Profile Card */}
          <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg space-y-3">
            <div className="aspect-square rounded bg-neutral-950 overflow-hidden relative border border-neutral-800">
              <img
                src={db.hero.avatarUrl}
                alt={db.hero.name}
                className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500"
              />
              <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-neutral-400 border border-neutral-800">
                HELIO_LELES.RAW
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 space-y-1">
              <p>• Coding since childhood</p>
              <p>• Hardware/ESP32 tinker</p>
              <p>• DSU Android enthusiast</p>
            </div>
          </div>
        </section>

        {/* WORKBENCH / HARDWARE & PROJECTS */}
        <section id="workbench" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>ACTIVE_WORKBENCH_LOGS</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">{db.projects.length} PROJECTS</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {db.projects.map((p) => (
              <div key={p.id} className="p-4 rounded bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-amber-400 border border-neutral-700">
                      {p.category}
                    </span>
                    <h4 className="font-bold text-sm text-neutral-200 mt-2">{p.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">{p.status}</span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">{p.description}</p>

                <div className="flex items-center justify-between pt-2 text-xs font-mono border-t border-neutral-800/60">
                  <div className="flex gap-1">
                    {p.tags.map((t, i) => (
                      <span key={i} className="text-[10px] text-neutral-500">#{t}</span>
                    ))}
                  </div>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="text-amber-500 hover:underline flex items-center gap-0.5">
                      Repo <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AUDIO TAPES / SONGS I LOVE */}
        <section id="tapes" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Disc className="w-4 h-4 text-amber-500" />
              <span>AUDIO_TAPES (SHUFFLED)</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">LIVE PREVIEWS</span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {db.songs.map((song) => {
              const active = currentSongId === song.id;
              return (
                <div
                  key={song.id}
                  className={`p-3 rounded border transition-all flex flex-col justify-between ${
                    active
                      ? 'bg-neutral-900 border-amber-500'
                      : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-14 h-14 rounded bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
                      <img src={song.albumArt} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => togglePlay(song)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
                      >
                        {active && isPlaying ? (
                          <Pause className="w-5 h-5 text-amber-400 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-neutral-200 truncate">{song.title}</h4>
                      <p className="text-[11px] text-neutral-400 truncate">{song.artist}</p>
                      {song.note && <p className="text-[10px] font-mono text-neutral-500 truncate mt-1">"{song.note}"</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TINKER LOGS */}
        <section id="logs" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-500" />
              <span>SYSTEM_LOGS</span>
            </h3>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded p-4 font-mono text-xs space-y-2">
            {db.logs.map((l, i) => (
              <div key={i} className="flex gap-3 text-neutral-400">
                <span className="text-neutral-600 shrink-0">[{l.date}]</span>
                <span className="text-neutral-300">{l.entry}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-neutral-800 text-xs font-mono text-neutral-600 flex justify-between">
          <span>Helio Leles // cli.4helio.xyz connected</span>
          <span>No startup bloat. Just code & music.</span>
        </footer>

      </div>

      {/* ADMIN MODAL */}
      {isAdminOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden text-xs">

            <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <span className="font-bold text-amber-500 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> ADMIN_CONTROL_CENTER
              </span>
              <button onClick={() => setIsAdminOpen(false)} className="p-1 hover:text-white text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isUnlocked ? (
              <form onSubmit={handleVerifyPin} className="p-6 space-y-4 text-center">
                <p className="text-neutral-400">Enter Admin PIN to unlock database controls.</p>
                <input
                  type="password"
                  placeholder="PIN"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full max-w-xs text-center font-mono py-2 bg-neutral-950 border border-neutral-700 rounded text-amber-400 text-base outline-none focus:border-amber-500"
                />
                {pinErr && <p className="text-red-400 text-[11px]">Invalid Security PIN</p>}
                <div>
                  <button type="submit" className="px-4 py-2 rounded bg-amber-500 text-black font-bold hover:bg-amber-400">
                    Authenticate
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 p-4">
                <div className="flex border-b border-neutral-800 gap-4 text-neutral-400">
                  <button
                    onClick={() => setAdminTab('hero')}
                    className={`pb-2 ${adminTab === 'hero' ? 'border-b-2 border-amber-500 text-amber-400 font-bold' : ''}`}
                  >
                    Hero Status
                  </button>
                  <button
                    onClick={() => setAdminTab('songs')}
                    className={`pb-2 ${adminTab === 'songs' ? 'border-b-2 border-amber-500 text-amber-400 font-bold' : ''}`}
                  >
                    Songs Manager
                  </button>
                  <button
                    onClick={() => setAdminTab('logs')}
                    className={`pb-2 ${adminTab === 'logs' ? 'border-b-2 border-amber-500 text-amber-400 font-bold' : ''}`}
                  >
                    Add Log
                  </button>
                </div>

                {adminTab === 'hero' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-neutral-500 mb-1">Status Text</label>
                      <input
                        type="text"
                        value={db.hero.status}
                        onChange={(e) => updateResource('hero', { status: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1">Bio</label>
                      <textarea
                        rows={3}
                        value={db.hero.bio}
                        onChange={(e) => updateResource('hero', { bio: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                  </div>
                )}

                {adminTab === 'songs' && (
                  <div className="space-y-4">
                    <form onSubmit={searchITunes} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search track title or artist..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                      <button type="submit" disabled={isSearching} className="px-3 py-2 bg-neutral-800 text-neutral-200 rounded font-bold flex items-center gap-1">
                        {isSearching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        Search API
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1 bg-neutral-950 p-2 rounded border border-neutral-800">
                        {searchResults.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-1.5 hover:bg-neutral-900 rounded">
                            <span className="truncate max-w-[250px]">{s.title} - {s.artist}</span>
                            <button onClick={() => addSong(s)} className="text-amber-500 hover:underline">
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-neutral-500 font-bold">Active Songs:</p>
                      {db.songs.map((s) => (
                        <div key={s.id} className="flex justify-between items-center bg-neutral-950 p-2 rounded border border-neutral-800">
                          <span className="truncate">{s.title} - {s.artist}</span>
                          <button onClick={() => deleteSong(s.id)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {adminTab === 'logs' && (
                  <form onSubmit={addLog} className="space-y-3">
                    <label className="block text-neutral-500">New System Log Entry</label>
                    <input
                      type="text"
                      placeholder="e.g. Flashed microcode on ESP32..."
                      value={newLogEntry}
                      onChange={(e) => setNewLogEntry(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                    />
                    <button type="submit" className="px-4 py-2 bg-amber-500 text-black font-bold rounded">
                      Publish Log
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

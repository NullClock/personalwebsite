import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Cpu, Music, Radio, Wrench, Lock, Unlock,
  Trash2, Plus, Search, ExternalLink, Play, Pause, X,
  Check, RefreshCw, Sliders, Shield, Activity, Disc,
  ArrowUpRight, Share2, Image as ImageIcon, Save, LogOut, FileText, Menu, Link,
  CrossIcon
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cli.4helio.xyz/api';

export default function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Mobile Menu Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin Auth & Fullscreen Modal
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinErr, setPinErr] = useState(false);
  const [adminTab, setAdminTab] = useState('hero');

  // Editable Form Data in Admin
  const [editDb, setEditDb] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Audio Player State
  const [currentSongId, setCurrentSongId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Song Search
  const [searchQuery, setSearchQuery] = useState('');
  const [specialSearchQuery, setSpecialSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Now Playing
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [albumArtURL, setAlbumArtURL] = useState('');
  const [audioPreviewURL, setAudioPreviewURL] = useState('');
  const [audioPreviewEnabled, setAudioPreviewEnabled] = useState(false);

  // Check Metered Connection
  const [isMetered, setIsMetered] = useState(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn ? conn.saveData || conn.cellular : false;
  });

  const [featuredSong, setFeaturedSong] = useState({});

  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;

    const updateConnectionStatus = () => {
      setIsMetered(conn.saveData || conn.cellular);
    };

    conn.addEventListener('change', updateConnectionStatus);
    return () => conn.removeEventListener('change', updateConnectionStatus);
  }, []);

  const fetchData = async () => {
    try {
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/data`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setDb(data);
      setEditDb(JSON.parse(JSON.stringify(data)));
    } catch (e) {
      console.error("Failed to fetch data", e);
      setErrorMsg(e.message || 'Failed to reach API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const saveAllChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/db`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify(editDb)
      });
      if (res.ok) {
        setDb(JSON.parse(JSON.stringify(editDb)));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert("Save failed. Check Admin PIN.");
      }
    } catch (err) {
      alert("Error saving data to server.");
    } finally {
      setSaving(false);
    }
  };

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
        note: 'Added via Admin'
      }));
      setSearchResults(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const searchITunesSpecial = async (query) => {
    // if (!searchQuery.trim()) return;
    // setIsSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=8`);
      const data = await res.json();
      const formatted = data.results.map(item => ({
        id: `itunes-${item.trackId}`,
        title: item.trackName,
        artist: item.artistName,
        albumArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '',
        previewUrl: item.previewUrl,
        note: 'Added via Admin'
      }));
      // setSearchResults(formatted);
      return formatted;
    } catch (err) {
      console.error(err);
    } finally {
      // setIsSearching(false);
    }
  };

  const getDateInYYYYMMDD = () => {
    const date = new Date();

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');

    const formattedDate = `${yyyy}-${mm}-${dd}`;

    return formattedDate;
  }

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

  const fetchNowPlaying = async () => {
    try {
      const res = await fetch(`${API_BASE}/nowplaying`);

      if (!res.ok) {
        setSongTitle('No Song');
        setSongArtist('N/A');
        setAlbumArtURL('/uploads/ic.png');
        setAudioPreviewURL('');
        setAudioPreviewEnabled(false);

        setFeaturedSong({
          enabled: false
        });

        return;
      }

      const data = await res.json();

      const itquery = `${data["android.media.metadata.TITLE"]} ${data["android.media.metadata.ARTIST"]}`;
      setSpecialSearchQuery(itquery);
      const _itunesResult = await searchITunesSpecial(itquery);
      const itunesResult = _itunesResult && _itunesResult[0];

      setSongTitle(data["android.media.metadata.TITLE"]);
      setSongArtist(data["android.media.metadata.ARTIST"]);
      setAlbumArtURL(itunesResult ? itunesResult.albumArt : "/uploads/ic.png");
      setAudioPreviewURL(itunesResult ? itunesResult.previewUrl : null);
      setAudioPreviewEnabled(itunesResult ? (itunesResult.previewUrl ? true : false) : false);

      setFeaturedSong({
        enabled: true,
        id: "nwp",
        title: data["android.media.metadata.TITLE"],
        artist: data["android.media.metadata.ARTIST"],
        albumArt: itunesResult ? itunesResult.albumArt : "/uploads/ic.png",
        previewUrl: itunesResult ? itunesResult.previewUrl : null,
        note: "Now Playing"
      });
    } catch (e) {
      setSongTitle('No Song');
      setSongArtist('N/A');
      setAlbumArtURL('/uploads/ic.png');
      setAudioPreviewURL('');
      setAudioPreviewEnabled(false);
    }
  }

  function getYearsBetween(date1, date2) {
    const start = new Date(date1);
    const end = new Date(date2);

    // 1. Get the difference in calendar years
    let years = end.getFullYear() - start.getFullYear();

    // 2. Adjust if the anniversary hasn't occurred yet in the final year
    const monthDiff = end.getMonth() - start.getMonth();
    const dayDiff = end.getDate() - start.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }

    return years;
  }


  function clearNowPlayingAdmin() {
    fetch("https://cli.4helio.xyz/api/nowplaying", {
      method: "DELETE",
      headers: {
        "x-admin-pin": adminPin
      }
    });
  }


  // fetchNowPlaying();

  useEffect(() => {
    if (!db) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      "name": hero.name,
      "url": "https://4helio.xyz",
      "jobTitle": "Software & Hardware Developer",
      "sameAs": (db.socials || []).filter(s => !s.disabled).map(s => s.href)
    });
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, [db]);

  useEffect(() => {
    const id = setInterval(fetchNowPlaying, isMetered ? 10500 : 1000);
    return () => clearInterval(id);
  }, [isMetered]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 font-mono flex items-center justify-center text-xs">
        <Activity className="w-4 h-4 animate-spin text-amber-500 mr-2" />
        connecting to super integrated portfolio engine...
      </div>
    );
  }

  if (errorMsg || !db) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 font-mono flex flex-col items-center justify-center text-xs p-6 gap-3">
        <div className="p-3 bg-red-950/40 border border-red-800/80 rounded text-red-400 text-center max-w-sm">
          <p className="font-bold mb-1">Connection Error</p>
          <p className="text-[11px] text-neutral-400">{'Could not load data from portfolio engine.'}</p>
        </div>
        <button onClick={fetchData} className="px-3 py-1.5 bg-neutral-800 text-neutral-200 rounded border border-neutral-700 hover:border-amber-500">
          Retry Connection
        </button>
      </div>
    );
  }

  // Safe destructuring fallbacks
  const hero = db.hero || {};
  const banner = db.banner || {};
  const socials = Array.isArray(db.socials) ? db.socials : [];
  const projects = Array.isArray(db.projects) ? db.projects : [];
  const songs = Array.isArray(db.songs) ? db.songs : [];
  // const featuredSong = db.featuredSong || {};
  const logs = Array.isArray(db.logs) ? db.logs : [];

  return (
    <div className="min-h-screen bg-[#111110] text-neutral-200 font-sans selection:bg-amber-500 selection:text-black">

      {/* Dynamic Announcement Banner */}
      {banner.enabled && (
        <div className="bg-amber-500 text-neutral-950 px-4 py-2 text-xs font-mono font-bold flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="inline-block w-2 h-2 bg-black animate-ping rounded-full shrink-0"></span>
            <span className="truncate">{banner.text}</span>
          </div>
          {banner.linkUrl && (
            <a href={banner.linkUrl} className="underline hover:text-white shrink-0 ml-4">
              {banner.linkText || 'Open'} →
            </a>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-6 py-6 md:py-10 space-y-10 md:space-y-12 overflow-hidden">

        {/* Top Header Navigation */}
        <header className="border-b border-neutral-800 pb-4 md:pb-6 relative">
          <div className="flex items-center justify-between">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-amber-500 text-sm">
                HL
              </div>
              <div>
                <h1 className="font-bold text-sm text-neutral-100 tracking-wide">{hero.name}</h1>
                <p className="text-xs text-neutral-500 font-mono">{hero.location}</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-4 text-xs font-mono">
              <a href="#workbench" className="text-neutral-400 hover:text-amber-400 transition-colors">/workbench</a>
              <a href="#tapes" className="text-neutral-400 hover:text-amber-400 transition-colors">/audio</a>
              <a href="#logs" className="text-neutral-400 hover:text-amber-400 transition-colors">/logs</a>
              <button
                onClick={() => {
                  setEditDb(JSON.parse(JSON.stringify(db)));
                  setIsAdminOpen(true);
                }}
                className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-amber-500 text-neutral-300 text-xs font-mono flex items-center gap-1.5 transition-all shadow"
              >
                <Wrench className="w-3 h-3 text-amber-500" />
                <span>[Admin Portal]</span>
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-amber-400 hover:border-neutral-700 transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Navigation Dropdown Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-neutral-800/80 flex flex-col space-y-3 font-mono text-xs bg-neutral-950 p-4 rounded-lg border border-neutral-800 shadow-xl">
              <a
                href="#workbench"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-amber-400 py-1 flex items-center gap-2"
              >
                <Cpu className="w-3.5 h-3.5 text-amber-500" /> /workbench
              </a>
              <a
                href="#tapes"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-amber-400 py-1 flex items-center gap-2"
              >
                <Disc className="w-3.5 h-3.5 text-amber-500" /> /audio
              </a>
              <a
                href="#logs"
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-300 hover:text-amber-400 py-1 flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-500" /> /logs
              </a>
              <div className="pt-2 border-t border-neutral-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setEditDb(JSON.parse(JSON.stringify(db)));
                    setIsAdminOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" /> Open Admin Portal
                </button>
              </div>
            </div>
          )}
        </header>

        {/* HERO / STATUS SECTION */}
        <section className="grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              {hero.status.replace("%bdaystr", `June 3, 2012 - ${getYearsBetween("2012-06-03", getDateInYYYYMMDD())} years ago`)}
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-100 tracking-tight leading-snug">
              {/* <u>WEBSITE REDESIGN IN PROGRESS!</u>Helio Leles */} {hero.name}
            </h2>

            <p className="text-neutral-400 text-sm leading-relaxed">
              {hero.bio}
            </p>

            {/* Social Links */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono">
              {socials.map((s, idx) => (
                <a
                  key={s.id || idx}
                  href={s.disabled ? "javascript:void(0);" : s.href}
                  target={s.disabled ? "" : "_blank"}
                  rel="noreferrer"
                  className=
                  {
                    s.disabled ?
                      "line-through px-2.5 py-1 rounded bg-black border border-neutral-800 text-neutral-400/70 transition-all flex items-center gap-1" :
                      "px-2.5 py-1 rounded bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-all flex items-center gap-1"}
                >
                  <span><Link className={
                    s.disabled ?
                      "w-4 h-4 text-neutral-400/70 shrink-0" :
                      "w-4 h-4 text-white shrink-0"
                  } /></span>
                  <span>{s.name}</span>
                  <span className="text-neutral-500">{s.handle}</span>
                </a>
              ))}
            </div>

            <div>
            </div>
          </div>

          {/* Avatar Profile Card */}
          {/* PATCH: added min-w-0 so this column can shrink instead of forcing a wider layout */}
          <div className="bg-neutral-900 border border-neutral-800 space-y-3 min-w-0 w-full sm:w-auto">
            <div className="aspect-square bg-neutral-950 overflow-hidden relative border border-neutral-800">
              <img
                src={hero.avatarUrl}
                alt={hero.name}
                className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500"
              />
              <div className="md:hidden absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400 border border-neutral-800">
                {'TAP FOR COLOR'}
              </div>

              <div className="hidden md:flex absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400 border border-neutral-800">
                {'HOVER FOR COLOR'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 space-y-1 p-3">
              {(hero.bullets || []).map((b, i) => (
                <p key={i}>• {b}</p>
              ))}

              {true && (
                <>
                  <br />

                  <div className="mx-auto text-center">
                    <span className="text-base text-neutral-200 text-center">Currently Playing</span>
                    <br />
                    <span className="text-[12px] text-neutral-400 text-center">Live from Helio's Phone</span>
                  </div>
                </>
              )}

              {featuredSong.enabled && (
                <div
                  key={featuredSong.id}
                  className={`p-3 rounded border transition-all flex flex-col justify-between h-fit min-w-0 ${currentSongId === featuredSong.id
                    ? 'bg-neutral-900 border-amber-500'
                    : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                  onBlur={() => { setCurrentSongId(0) }}
                >
                  {/* PATCH: min-w-0 on the flex row so the text column below can actually shrink/truncate */}
                  <div className="flex gap-3 items-center w-full min-w-0">
                    <div className="w-14 h-14 rounded-full animate-[spin_5s_linear_infinite] bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
                      <img src={featuredSong.albumArt} alt="" className="w-full h-full object-cover" />
                      {audioPreviewEnabled && (
                        <button onClick={() => togglePlay(featuredSong)} className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
                          {currentSongId === featuredSong.id && isPlaying ? (<Pause className="w-5 h-5 text-amber-400 fill-current" />) : (<Play className="w-5 h-5 text-white fill-current ml-0.5" />)}
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-neutral-200 mb-2 truncate">{featuredSong.title}</h4>
                      <p className="text-[11px] text-neutral-400 truncate">{featuredSong.artist}</p>
                    </div>
                  </div>
                </div>
              )}

              {!featuredSong.enabled && (
                <div
                  key={featuredSong.id}
                  className={`p-3 border transition-all flex flex-col justify-between h-fit min-w-0 ${currentSongId === featuredSong.id
                    ? 'bg-neutral-900 border-amber-500'
                    : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                  onBlur={() => { setCurrentSongId(0) }}
                >
                  {/* PATCH: min-w-0 on the flex row so the text column below can actually shrink/truncate */}
                  <div className="flex gap-3 items-center w-full min-w-0">
                    <div className="w-14 h-14 rounded-full animate-[spin_5s_linear_infinite] bg-neutral-950 overflow-hidden relative border border-neutral-800 shrink-0">
                      <img src={"/uploads/ic.png"} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-neutral-200 mb-2 truncate">No Song</h4>
                      <p className="text-[11px] text-neutral-400 truncate">N/A</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* WORKBENCH PROJECTS */}
        <section id="workbench" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>ACTIVE_WORKBENCH_LOGS</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">{projects.length} PROJECTS</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((p, idx) => (
              <div key={p.id || idx} className="p-4 rounded bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all space-y-3">
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
                  <div className="flex gap-1 flex-wrap">
                    {(p.tags || []).map((t, i) => (
                      <span key={i} className="text-[10px] text-neutral-500">#{t}</span>
                    ))}
                  </div>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className={
                      p.link == "javascript:void(0);" ?
                        "line-through text-neutral-400/70 hover:underline flex items-center gap-0.5" :
                        "text-amber-500 hover:underline flex items-center gap-0.5"
                    }>
                      Repo <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MUSIC TAPES */}
        <section id="tapes" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Disc className="w-4 h-4 text-amber-500" />
              <span>songs i like (SHUFFLED)</span>
            </h3>
            <span className="text-xs font-mono text-neutral-600">LIVE PREVIEWS</span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {songs.map((song, idx) => {
              const active = currentSongId === song.id;
              return (
                <div
                  key={song.id || idx}
                  className={`p-3 rounded border transition-all flex flex-col justify-between min-w-0 ${active
                    ? 'bg-neutral-900 border-amber-500'
                    : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                >
                  <div className="flex gap-3 items-center min-w-0">
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
                      {/* {song.note && <p className="text-[10px] font-mono text-neutral-500 truncate mt-1">"{song.note}"</p>} */}
                      <p className="text-[10px] font-mono text-neutral-500 truncate mt-1">"{song.note}"</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SYSTEM LOGS */}
        <section id="logs" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-sm font-mono font-bold text-neutral-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-500" />
              <span>SYSTEM_LOGS</span>
            </h3>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded p-4 font-mono text-xs space-y-2">
            {logs.map((l, i) => (
              <div key={l.id || i} className="flex gap-3 text-neutral-400">
                <span className="text-neutral-600 shrink-0">[{l.date}]</span>
                <span className="text-neutral-300">{l.entry}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-neutral-800 text-xs font-mono text-neutral-600 flex flex-col md:flex-row gap-2 justify-between">
          <span>Helio Leles // Dynamic Deeply Connected Portfolio Engine</span>
          <span>Album artwork, song previews, and related metadata are provided via the iTunes Search API and are the property of Apple Inc. and/or the respective content owners. This site is not affiliated with, endorsed by, or sponsored by Apple Inc.</span>
          <span>This site uses the iTunes Search API to display album artwork, song previews, and metadata. All such content is © Apple Inc. and/or the applicable rights holders and is provided for informational/preview purposes only. iTunes and Apple are trademarks of Apple Inc. This site is not affiliated with or endorsed by Apple.</span>
        </footer>

      </div>

      {/* FULL-SCREEN ADMIN MANAGEMENT DASHBOARD */}
      {isAdminOpen && editDb && (
        <div className="fixed inset-0 bg-[#0c0c0b] z-50 overflow-y-auto font-mono text-xs text-neutral-200 flex flex-col">

          {/* Top Admin Workstation Bar */}
          <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-amber-500 rounded text-black flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-100 text-sm">WORKSTATION_ADMIN // FULL_CONTROL</h3>
                <p className="text-[11px] text-neutral-500">Live sync target: {API_BASE}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isUnlocked && (
                <button
                  onClick={saveAllChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center gap-1.5 transition-colors shadow"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saveSuccess ? 'SAVED TO DB!' : 'SAVE EVERYTHING'}
                </button>
              )}
              <button
                onClick={() => setIsAdminOpen(false)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Authentication Barrier */}
          {!isUnlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-lg p-6 text-center space-y-4 shadow-2xl">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="font-bold text-neutral-200 text-base">ADMIN PORTALLLLLLL</h4>
                <p className="text-neutral-400 text-xs">Enter your PIN to unlock.</p>
                <form onSubmit={handleVerifyPin} className="space-y-3">
                  <input
                    type="password"
                    placeholder="ENTER PIN..."
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full text-center py-2.5 bg-neutral-950 border border-neutral-700 rounded text-amber-400 text-lg tracking-widest outline-none focus:border-amber-500"
                  />
                  {pinErr && <p className="text-red-400 text-[11px]">Wrong PIN.</p>}
                  <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded">
                    Unlock
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Full Control Editor Tabs */
            <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid md:grid-cols-4 gap-6 items-start">

              {/* Sidebar Tabs */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {[
                  { id: 'hero', label: 'Hero & Images', icon: ImageIcon },
                  { id: 'socials', label: 'Social Handles', icon: Share2 },
                  { id: 'projects', label: 'Workbench Projects', icon: Cpu },
                  { id: 'songs', label: 'Music & iTunes', icon: Music },
                  { id: 'logs', label: 'System Logs', icon: FileText },
                  { id: 'banner', label: 'Top Banner', icon: Radio },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAdminTab(t.id)}
                    className={`whitespace-nowrap md:w-full text-left px-3 py-2.5 rounded flex items-center gap-2 font-bold transition-colors ${adminTab === t.id
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                      }`}
                  >
                    <t.icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Editor Workspace */}
              <div className="md:col-span-3 bg-neutral-900 border border-neutral-800 rounded-lg p-4 md:p-6 space-y-6">

                {/* 1. HERO & IMAGES */}
                {adminTab === 'hero' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-amber-500 uppercase">Profile Info & Image URL Settings</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-neutral-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={editDb.hero?.name || ''}
                          onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, name: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Location</label>
                        <input
                          type="text"
                          value={editDb.hero?.location || ''}
                          onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, location: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Status Badge Text</label>
                      <input
                        type="text"
                        value={editDb.hero?.status || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, status: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Bio Text</label>
                      <textarea
                        rows={3}
                        value={editDb.hero?.bio || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, bio: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Avatar Profile Picture URL</label>
                      <input
                        type="text"
                        value={editDb.hero?.avatarUrl || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, avatarUrl: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Avatar Image Badge Overlay</label>
                      <input
                        type="text"
                        value={editDb.hero?.avatarBadge || ''}
                        onChange={(e) => setEditDb({ ...editDb, hero: { ...editDb.hero, avatarBadge: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                  </div>
                )}

                {/* 2. SOCIAL HANDLES */}
                {adminTab === 'socials' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">Manage Social Handles & Links</h4>
                      <button
                        onClick={() => {
                          const newSoc = { id: `soc-${Date.now()}`, name: "New Social", handle: "@user", href: "https://" };
                          setEditDb({ ...editDb, socials: [...(editDb.socials || []), newSoc] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Handle
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(editDb.socials || []).map((soc, idx) => (
                        <div key={soc.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded grid sm:grid-cols-4 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Platform Name"
                            value={soc.name}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].name = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <input
                            type="text"
                            placeholder="@username"
                            value={soc.handle}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].handle = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <input
                            type="text"
                            placeholder="https://..."
                            value={soc.href}
                            onChange={(e) => {
                              const copy = [...editDb.socials];
                              copy[idx].href = e.target.value;
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <button
                            onClick={() => {
                              const copy = editDb.socials.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, socials: copy });
                            }}
                            className="text-red-400 hover:text-red-300 justify-self-end p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. WORKBENCH PROJECTS */}
                {adminTab === 'projects' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">Workbench Hardware & Software Projects</h4>
                      <button
                        onClick={() => {
                          const newProj = {
                            id: `proj-${Date.now()}`,
                            title: "New Lab Experiment",
                            category: "Hardware",
                            status: "Prototype",
                            description: "Description of build...",
                            tags: ["ESP32", "C++"],
                            link: "https://github.com/NullClock/"
                          };
                          setEditDb({ ...editDb, projects: [newProj, ...(editDb.projects || [])] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Project
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(editDb.projects || []).map((proj, idx) => (
                        <div key={proj.id || idx} className="p-4 bg-neutral-950 border border-neutral-800 rounded space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-500">PROJECT #{idx + 1}</span>
                            <button
                              onClick={() => {
                                const copy = editDb.projects.filter((_, i) => i !== idx);
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Title"
                              value={proj.title}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].title = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Category"
                              value={proj.category}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].category = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Status Badge"
                              value={proj.status}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].status = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={proj.description}
                            onChange={(e) => {
                              const copy = [...editDb.projects];
                              copy[idx].description = e.target.value;
                              setEditDb({ ...editDb, projects: copy });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                          />
                          <div className="grid sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Tags (comma separated)"
                              value={proj.tags?.join(', ') || ''}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].tags = e.target.value.split(',').map(t => t.trim());
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                            <input
                              type="text"
                              placeholder="Repo URL"
                              value={proj.link || ''}
                              onChange={(e) => {
                                const copy = [...editDb.projects];
                                copy[idx].link = e.target.value;
                                setEditDb({ ...editDb, projects: copy });
                              }}
                              className="bg-neutral-900 border border-neutral-800 rounded p-2 text-neutral-200"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. MUSIC & ITUNES SEARCH */}
                {adminTab === 'songs' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-amber-500 uppercase">Search & Add Songs from iTunes API</h4>
                    <form onSubmit={searchITunes} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search track title or artist..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                      <button type="submit" disabled={isSearching} className="px-3 py-2 bg-amber-500 text-black rounded font-bold flex items-center gap-1">
                        {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Search API
                      </button>
                    </form>

                    <button className="px-3 py-2 w-full text-center bg-amber-500 text-black rounded font-bold" onClick={clearNowPlayingAdmin}>
                      Clear Now Playing
                    </button>

                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-neutral-950 p-2 rounded border border-neutral-800">
                        {searchResults.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-2 hover:bg-neutral-900 rounded">
                            <div className="flex items-center gap-2">
                              <img src={s.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                              <span className="truncate max-w-[280px]">{s.title} - {s.artist}</span>
                            </div>
                            <button
                              onClick={() => {
                                const existingSongs = editDb.songs || [];
                                if (!existingSongs.some(existing => existing.id === s.id)) {
                                  setEditDb({ ...editDb, songs: [s, ...existingSongs] });
                                }
                              }}
                              className="text-amber-400 hover:underline text-xs"
                            >
                              + Add Track
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <h5 className="font-bold text-neutral-400">Current Songs ({(editDb.songs || []).length})</h5>
                      {(editDb.songs || []).map((song, idx) => (
                        <div key={song.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={song.albumArt} alt="" className="w-10 h-10 rounded object-cover" />
                            <div>
                              <p className="font-bold text-neutral-200">{song.title}</p>
                              <p className="text-neutral-500 text-[11px]">{song.artist}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const copy = editDb.songs.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, songs: copy });
                            }}
                            className="text-red-400 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. SYSTEM LOGS */}
                {adminTab === 'logs' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-amber-500 uppercase">System Logs</h4>
                      <button
                        onClick={() => {
                          const newLog = {
                            id: `log-${Date.now()}`,
                            date: new Date().toISOString().split('T')[0],
                            entry: "New workbench log entry..."
                          };
                          setEditDb({ ...editDb, logs: [newLog, ...(editDb.logs || [])] });
                        }}
                        className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Log
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(editDb.logs || []).map((log, idx) => (
                        <div key={log.id || idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded flex items-center gap-3">
                          <input
                            type="text"
                            value={log.date}
                            onChange={(e) => {
                              const copy = [...editDb.logs];
                              copy[idx].date = e.target.value;
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="w-28 bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-400 font-mono text-center"
                          />
                          <input
                            type="text"
                            value={log.entry}
                            onChange={(e) => {
                              const copy = [...editDb.logs];
                              copy[idx].entry = e.target.value;
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="flex-1 bg-neutral-900 border border-neutral-800 rounded p-1.5 text-neutral-200"
                          />
                          <button
                            onClick={() => {
                              const copy = editDb.logs.filter((_, i) => i !== idx);
                              setEditDb({ ...editDb, logs: copy });
                            }}
                            className="text-red-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. BANNER SETTINGS */}
                {adminTab === 'banner' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-amber-500 uppercase">Top Announcement Banner Configuration</h4>
                    <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded">
                      <input
                        type="checkbox"
                        checked={Boolean(editDb.banner?.enabled)}
                        onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, enabled: e.target.checked } })}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <label className="text-neutral-300 font-bold">Banner Enabled on Website</label>
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Banner Announcement Text</label>
                      <input
                        type="text"
                        value={editDb.banner?.text || ''}
                        onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, text: e.target.value } })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-neutral-400 mb-1">Link Button Label</label>
                        <input
                          type="text"
                          value={editDb.banner?.linkText || ''}
                          onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, linkText: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Destination URL / Anchor</label>
                        <input
                          type="text"
                          value={editDb.banner?.linkUrl || ''}
                          onChange={(e) => setEditDb({ ...editDb, banner: { ...editDb.banner, linkUrl: e.target.value } })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import Section from "./Section";
import Reveal from "./Reveal";
import "../styles/Songs.css";

export default function Songs({ songs = [] }) {
  const audioRef = useRef(null);
  const playToken = useRef(0);
  const [playingIndex, setPlayingIndex] = useState(null);

  // One audio element for the whole section. Previews only start on an explicit click.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    const reset = () => setPlayingIndex(null);
    audio.addEventListener("ended", reset);
    audio.addEventListener("error", reset);
    audioRef.current = audio;

    return () => {
      playToken.current += 1;
      audio.removeEventListener("ended", reset);
      audio.removeEventListener("error", reset);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  const toggle = (song, index) => {
    const audio = audioRef.current;
    if (!audio || !song.previewUrl) return;

    const token = ++playToken.current;
    if (playingIndex === index) {
      audio.pause();
      setPlayingIndex(null);
      return;
    }

    audio.pause();
    audio.src = song.previewUrl;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        if (token === playToken.current) setPlayingIndex(index);
      })
      .catch(() => {
        if (token === playToken.current) setPlayingIndex(null);
      });
  };

  return (
    <Section id="music" label="Featured songs">
      <div className="songs-grid">
        {songs.map((song, i) => {
          const playing = playingIndex === i;
          return (
            <Reveal key={`${song.title}-${song.artist}`} delay={i % 4} className="song-reveal">
              <button
                type="button"
                className={`song-card${playing ? " is-playing" : ""}`}
                onClick={() => toggle(song, i)}
                aria-pressed={playing}
                aria-label={`${playing ? "Pause" : "Play"} preview of ${song.title} by ${song.artist}`}
              >
                <span className="song-cover">
                  <img src={song.albumArt} alt="" width="600" height="600" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  <span className="song-play" aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
                </span>
                <span className="song-info">
                  <span className="song-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="song-title" title={song.title}>{song.title}</span>
                  <span className="song-artist" title={song.artist}>{song.artist}</span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

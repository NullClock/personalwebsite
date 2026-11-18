import Reveal from "./Reveal";
import "../styles/Marquee.css";

export default function Marquee({ words }) {
  const line = words.map((w) => `${w} — `).join("");
  return (
    <Reveal className="marquee" aria-hidden="true">
      <div className="marquee-track">{line.repeat(4)}</div>
    </Reveal>
  );
}

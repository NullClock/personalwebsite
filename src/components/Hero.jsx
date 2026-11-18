import "../styles/Hero.css";

export default function Hero({ name, subtitle }) {
  let letterIndex = 0; // keeps the stagger running across words

  return (
    <header className="hero">
      <div className="hero-inner">
        <h1 aria-label={name}>
          {name.split(" ").map((word, w) => (
            <span className="word" key={w} aria-hidden="true">
              {[...word].map((letter, l) => (
                <span className="letter" key={l}>
                  <i style={{ "--i": letterIndex++ }}>{letter}</i>
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="subtitle">{subtitle}</p>
      </div>

      <a className="scroll-cue" href="#about" aria-label="Scroll down">
        SCROLL
        <svg viewBox="0 0 18 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 1v24M2 18l7 7 7-7" />
        </svg>
      </a>
    </header>
  );
}

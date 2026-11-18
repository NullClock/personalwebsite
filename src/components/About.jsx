import Section from "./Section";
import Reveal from "./Reveal";
import "../styles/About.css";

export default function About({ text, muted }) {
  return (
    <Section id="about" label="About">
      <Reveal as="p" delay={1} className="about-text">
        {text} <span className="muted">{muted}</span>
      </Reveal>
    </Section>
  );
}

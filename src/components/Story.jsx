import Section from "./Section";
import Reveal from "./Reveal";
import "../styles/Story.css";

export default function Story({ paragraphs = [] }) {
  return (
    <Section id="story" label="My story">
      <div className="story-copy">
        {paragraphs.map((paragraph, i) => (
          <Reveal as="p" key={i} delay={i} className="story-paragraph">
            {paragraph}
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

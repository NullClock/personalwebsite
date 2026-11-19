import Section from "./Section";
import "../styles/Names.css";

// Kept in the DOM and crawlable, but visually hidden — these aliases are here
// for search engines only. `clip`/transparent (not display:none) so crawlers
// still see the text.
export default function Names({ subtext, items = [] }) {
  return (
    <Section id="names" label="Names I go by" className="visually-hidden">
      {subtext && <p className="names-subtext">{subtext}</p>}
      <ul className="names-list">
        {items.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </Section>
  );
}

import Reveal from "./Reveal";

// Standard page section: a small label with an animated line, then your content.
export default function Section({ id, label, className = "", children }) {
  return (
    <section id={id} className={`section ${className}`}>
      {label && <Reveal as="h2" className="eyebrow">{label}</Reveal>}
      {children}
    </section>
  );
}

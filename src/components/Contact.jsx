import Section from "./Section";
import Reveal from "./Reveal";
import "../styles/Contact.css";

export default function Contact({ label, href }) {
  return (
    <Section id="contact" label="Contact">
      <Reveal delay={1}>
        <a className="contact-link" href={href}>{label}</a>
      </Reveal>
    </Section>
  );
}

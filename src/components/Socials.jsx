import Section from "./Section";
import Reveal from "./Reveal";
import "../styles/Socials.css";

export default function Socials({ socials = [] }) {
  return (
    <Section id="socials" label="Elsewhere">
      <ul className="social-list">
        {socials.map((social, i) => {
          const disabled = Boolean(social.disabled);
          return (
            <li key={social.name}>
              <Reveal
                as={disabled ? "div" : "a"}
                href={disabled ? undefined : social.href}
                target={disabled ? undefined : "_blank"}
                rel={disabled ? undefined : "noreferrer"}
                delay={i}
                className={`social-row${disabled ? " is-disabled" : ""}`}
              >
                <span className="social-number">{String(i + 1).padStart(2, "0")}</span>
                <span className="social-name">{social.name}</span>
                <span className="social-handle">{social.handle}</span>
                <span className="social-arrow" aria-hidden="true">↗</span>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

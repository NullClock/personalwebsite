import Reveal from "./Reveal";

// One row in the work list. Pass `href` to make it a link.
export default function ProjectRow({ index, title, tag, status, description, href }) {
  return (
    <Reveal
      as={href ? "a" : "div"}
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      delay={index}
      className="row"
    >
      <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
      <h3 className="row-title">{title}</h3>
      <span className="row-tag">
        <span>{tag}</span>
        {status && <span className="row-status">{status}</span>}
      </span>
      <p className="row-description">{description}</p>
    </Reveal>
  );
}

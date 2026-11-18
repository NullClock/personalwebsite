import Reveal from "./Reveal";

export default function Footer({ location }) {
  return (
    <footer className="footer">
      <Reveal as="span">{location}</Reveal>
      <Reveal as="span">© {new Date().getFullYear()}</Reveal>
    </footer>
  );
}

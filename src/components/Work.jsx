import Section from "./Section";
import ProjectRow from "./ProjectRow";
import "../styles/Work.css";

export default function Work({ projects }) {
  return (
    <Section id="work" label="Selected work">
      {projects.map((project, i) => (
        <ProjectRow key={project.title} index={i} {...project} />
      ))}
    </Section>
  );
}

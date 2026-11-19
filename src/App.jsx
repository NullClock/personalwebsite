import useContent from "./hooks/useContent";
import useScrollVars from "./hooks/useScrollVars";
import useSeo from "./hooks/useSeo";

import ScrollProgress from "./components/ScrollProgress";
import Hero from "./components/Hero";
import About from "./components/About";
import Marquee from "./components/Marquee";
import Work from "./components/Work";
import Story from "./components/Story";
import Names from "./components/Names";
import Songs from "./components/Songs";
import Socials from "./components/Socials";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import NowPlayingBar from "./components/NowPlayingBar";
import AdminPanel from "./components/AdminPanel";

// The page, top to bottom. To remove a section, delete its line.
// To reorder, move the line. To add one, create a component and drop it in.
export default function App() {
  const content = useContent();
  useSeo(content);
  useScrollVars();

  return (
    <>
      <ScrollProgress />
      <Hero {...content.hero} />
      <About {...content.about} />
      <Marquee words={content.marquee} />
      <Work projects={content.projects} />
      <Story {...content.story} />
      <Names {...content.names} />
      <Songs songs={content.songs} />
      <Socials socials={content.socials} />
      <Contact {...content.contact} />
      <Footer {...content.footer} />
      <NowPlayingBar />
      <AdminPanel />
    </>
  );
}

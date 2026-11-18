import useReveal from "../hooks/useReveal";

// Wrap anything in <Reveal> to fade/blur/rise it in on scroll.
//   as    : tag to render (default "div")
//   delay : stagger step, 1 = 0.1s
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "in" : ""} ${className}`}
      style={{ "--delay": delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

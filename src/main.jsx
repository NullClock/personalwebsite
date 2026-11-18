import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";

// The static snapshot in index.html is for crawlers/no-JS visitors only.
document.getElementById("static-fallback")?.remove();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

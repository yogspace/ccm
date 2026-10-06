import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./i18n";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root fehlt in index.html");

// Render once Pally is there – otherwise the font visibly jumps. If it never
// arrives (e.g. offline), the app starts anyway after a short while.
const fontReady = Promise.race([
  document.fonts.load('700 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

fontReady.finally(() =>
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
);

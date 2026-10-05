import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./i18n";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root fehlt in index.html");

// Erst rendern, wenn Pally da ist – sonst springt die Schrift sichtbar um.
// Bleibt sie aus (z. B. offline), startet die App nach kurzer Zeit trotzdem.
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

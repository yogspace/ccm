import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CardPage from "./card-page";
import "../i18n";
import "../index.css";
import "./card.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing in card/index.html");

// Render once Pally is there – the ring text is measured in it.
const fontReady = Promise.race([
  document.fonts.load('600 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

fontReady.finally(() =>
  createRoot(root).render(
    <StrictMode>
      <CardPage />
    </StrictMode>
  )
);

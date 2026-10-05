import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./i18n";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root fehlt in index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

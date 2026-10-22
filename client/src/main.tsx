import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSpotlight } from "./lib/spotlight";

initSpotlight();
createRoot(document.getElementById("root")!).render(<App />);

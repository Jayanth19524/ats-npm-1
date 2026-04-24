import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@/api-client";
import App from "./App";
import { installCredentialedFetch } from "./lib/viewer";
import "./index.css";

installCredentialedFetch();
setBaseUrl(import.meta.env.VITE_API_BASE_URL || "");

createRoot(document.getElementById("root")!).render(<App />);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import { I18nProvider } from "./i18n";
import { installErrorCollector } from "./feedback/collector";
import { registerServiceWorker } from "./pwa";
import App from "./App";
import "./styles/index.css";

registerServiceWorker();
installErrorCollector();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);

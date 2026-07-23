import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { isNativeApp } from "./lib/platform";
import { App } from "./App";
import "./index.css";

// Tauri (custom protocol) dan Capacitor (WebView lokal) sama-sama men-serve
// asset tanpa SPA-fallback server (beda dari Cloudflare Pages yang punya
// public/_redirects) — HashRouter tidak butuh fallback apa pun karena path
// selalu resolve ke index.html + hash fragment client-side. Build web/Pages
// tetap BrowserRouter karena isNativeApp() selalu false di browser biasa.
const Router = isNativeApp() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);

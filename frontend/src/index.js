import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";

// A phone cannot reach the development API through `localhost` because that
// points back to the phone. Public quick-tunnel previews therefore use the
// frontend origin and CRA's local API proxy. Production builds keep their
// explicitly configured backend origin unchanged.
if (window.location.hostname.endsWith(".trycloudflare.com")) {
  axios.interceptors.request.use((config) => {
    if (typeof config.url === "string" && /^https?:\/\/(localhost|127\.0\.0\.1):8000\/api(?:\/|$)/.test(config.url)) {
      const target = new URL(config.url);
      return { ...config, url: `${target.pathname}${target.search}` };
    }
    return config;
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

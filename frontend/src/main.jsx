import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./context/ToastContext";
import App from "./App";
import { ThemeModeProvider } from "./context/ThemeModeContext";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeModeProvider>
  </React.StrictMode>,
);

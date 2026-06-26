import React from "react";
import { createRoot } from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import { App } from "./App";
import { DappKitProviders } from "./dapp-kit";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DappKitProviders>
      <App />
    </DappKitProviders>
  </React.StrictMode>
);

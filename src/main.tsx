import React from "react";
import ReactDOM from "react-dom/client";
import { initApi } from "./shared/api";
import { prepareTarget } from "./shared/desktop/os";
import "./styles/index.css";

async function boot(): Promise<void> {
  await Promise.all([initApi(), prepareTarget()]);
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  const gallery = import.meta.env.DEV ? await import("./dev/gallery") : null;
  const galleryCase = gallery === null ? null : gallery.readGalleryCase(window.location.search);
  if (gallery !== null && galleryCase !== null) {
    root.render(
      <React.StrictMode>
        <gallery.Gallery id={galleryCase} />
      </React.StrictMode>,
    );
    return;
  }
  const { default: App } = await import("./App");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();

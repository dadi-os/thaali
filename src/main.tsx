import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import { initApi } from "./shared/api";
import { prepareTarget } from "./shared/desktop/os";
import { installInteraction } from "./shared/interaction";
import "./shared/theme/index.css";

async function boot(): Promise<void> {
  await Promise.all([initApi(), prepareTarget()]);
  installInteraction();
  if (import.meta.env.DEV && (window as Window & { __still?: boolean }).__still === true) {
    const { MotionGlobalConfig } = await import("motion/react");
    MotionGlobalConfig.skipAnimations = true;
  }
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
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </React.StrictMode>,
  );
}

void boot();

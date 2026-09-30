# Thaali

The desktop app for dadi: macOS, Windows, and Linux, plus a browser build. Thaali is its internal name; people see **dadi** (app name, window title, wordmark). Future modules ship as pages inside Thaali; the iPhone has its own native client (Khisso). Thaali has no application-level authentication — reaching mesh services requires a provisioned tailnet node (Tauri) or mesh-reachable browser (dev web).

## Dependencies

- Nas (`http://nas.dadi`) — provision, status, logs, module config
- Hath (`http://hath.dadi`) — agents, messages, events
- Yaad (`http://yaad.dadi`) — memory graph
- Chaavi (`http://chaavi.dadi` API, `https://chaavi.dadi` Bitwarden) — login password manager over the Chaavi adapter; extension for browser autofill
- Ghar (`http://ghar.dadi`) — rooms and Matter devices
- Dwar (indirect via Hath/Yaad)
- The dadi network (system `tailscaled` TUN + MagicDNS)

## Layout

```
thaali/
  src/
    pages/                 route construction sites
    features/<domain>/     agents, memory, timeline, ghar, chaavi, system, logs
      agents/              tree, popover (activity: each model turn's thinking, text and tool calls), host-session peek (browser frame + terminal chip)
      memory/              graph forces + connections, 3D network, node popover
    chrome/                AppShell, Header, chatSidebar/, shell hooks (tray, updater, device commands, provisioning)
      chatSidebar/         portable unit (index = construction site)
        list/ thread/ composer/ message/
        format.ts lanes.ts constants.ts ActivityPulse.tsx
    shared/
      api/                 transport + domain clients (hath/, yaad/, nas/)
        constants.ts       mesh URLs (no env fallbacks)
        transport.ts       Transport + ConnectionState
        browser-transport.ts  fetch + EventSource (web / nas compose)
        mesh-transport.ts     MeshTransport / the dadi network (Tauri; dynamic import)
        runtime.ts         isTauriRuntime / transport kind
        sse.ts / credentials.ts / types.ts
        hath/ yaad/ nas/ chaavi/ ghar/ portable client modules
      lib/
        platform/          logging helpers
        content/           attachments
        ux/                motion (incl. REVEAL preset), poll intervals, time formatting
      components/          IconButton, Popover/ (index + hover zone), ForceGraph/, Tooltip, WidgetFrame
      hooks/               useConnection, useEvents, useHoverDetails, useThemeTokens
    store/                 chat, connection, drafts, running, desktopShell
    styles/
  src-tauri/               Rust shell + logutil
  net/                     Tailscale CLI build for the desktop mesh
  Dockerfile               web container (dev Vite / production static)
```

## Config vs env

Mesh addresses are **constants** in `shared/api/constants.ts` — no URL env fallbacks. The desktop OS (window chrome) comes from `@tauri-apps/plugin-os` inside Tauri; outside Tauri, `detectDesktopOs` returns null. Optional `THAALI_LOG_FILE` appends Rust JSON logs for Alloy (Tauri only).

Signing / release secrets live in `.env.github` for CI only — not application runtime.

## Local run

Prerequisites once: `npm install`, then `cd net && ./build-tailscale.sh && cd ..`.

### Desktop (Tauri)

```sh
npm run tauri dev
```

### Web (Vite only)

```sh
npm run dev
# → http://localhost:8080 (or http://thaali.dadi if that host resolves here)
```

Browser transport — no mesh join. Mesh services must already be reachable from the machine.

`device_get_location`: macOS asks for Always (`NSLocationAlwaysAndWhenInUseUsageDescription` in [src-tauri/Info.plist](src-tauri/Info.plist)); Windows uses WinRT Geolocator (coords + coarse civic address, no Maps API key).

### Container (Dockerfile)

| Target | Role |
| --- | --- |
| `dev` | Vite on `0.0.0.0:8080`; source bind-mounted by Nas with `node_modules` preserved |
| `production` | `npm run build`, then `serve` static `dist` on 8080 with SPA fallback |

```sh
docker build --target production -t thaali .
```

## CI / CD

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` → `ci` | PR + push to `main` | `npm test`, `npm run build` |
| `ci.yml` → `container` | PR + push to `main` | `docker build --target production` |
| `ci.yml` → `publish` | `main` after `container` | `ghcr.io/dadi-os/thaali:latest` + sha tag |
| `ci.yml` → `release-desktop` | `main` after `ci` | AppImage / DMG / NSIS (+ macOS `.app.tar.gz` for updater) → GitHub Release `thaali-<sha>`; SemVer `0.0.<run_number>`. Go modules for the Tailscale build are cached per OS, keyed on `net/build-tailscale.sh` (which pins `TS_VER`) |
| `ci.yml` → `release-updater-manifest` | `main` after any successful `release-desktop` leg | `latest.json` for platforms that uploaded this run (omit missing OS; `.sig` files stay off the release) |

## Logging / error codes

Rust `logutil` emits nas-contract JSON (`time` RFC3339, `level`, `service=thaali`, `msg`, optional `code`) to stdout and optional `THAALI_LOG_FILE`. Frontend uses `shared/lib/platform/log.ts` for the same shape. Thaali’s Log explorer queries Nas → Loki.

## Addressing

| Constant | Address |
| --- | --- |
| `YAAD` | `http://yaad.dadi` |
| `HATH` | `http://hath.dadi` |
| `NAS` | `http://nas.dadi` |
| `CHAAVI` | `http://chaavi.dadi` (adapter API) |
| `CHAAVI_VAULT` | `https://chaavi.dadi` (Bitwarden clients; mesh CA) |

Plain HTTP on the WireGuard mesh. No localhost fallback.

## Provisioning

On the box: **Preferences → Devices** mints a Nas `POST /provision` setup QR. The bundle embeds the live LAN Headscale URL (`http://<lan>:8080`). New Tauri Thaali: camera scan (or paste) on that LAN → connect to dadi. Credentials store in app data. Browser Thaali has no provisioning.

Upgrading from the app when it was named Hath: the bundle ID is now `com.dadi.thaali`, so its app data (credentials) starts empty; add this computer as a device again. The first connect boots out and deletes the old `com.dadi.hath.sysmesh` LaunchDaemon so only one `tailscaled` owns the TUN.

## Window, menus and background

Closing the window hides it; the app keeps running so this device stays online for Hath's `device_*` tools, and the webview is never suspended while hidden (`backgroundThrottling: "disabled"`, macOS 14+). Reopen it from the Dock on macOS, the tray on Windows, or by launching dadi again (single-instance). Quit (Cmd/Ctrl+Q) exits the app; the system `tailscaled` stays connected either way, so `*.dadi` and `ssh os.dadi` keep working. Only Leave mesh (the power button) takes this device off dadi.

macOS and Linux get the dadi menu bar (Edit is macOS-only); Windows, which has no menu bar, gets the notification-area tray.

## Transport / the dadi network

All network calls go through a `Transport` (`shared/api/`). Tauri loads `MeshTransport` (dynamic import); the browser loads `BrowserTransport` (fetch + EventSource, Nas `/health` for ONLINE/OFFLINE). Browser Thaali is for Nas compose on-box UI only — it does not join Headscale.

Lifecycle (Tauri):

- Unprovisioned → onboarding (scan/paste)
- Provisioned + mesh down → glassy power overlay (tap to join); no silent auto-start
- Connected → app UI; chrome power control leaves the mesh
- Power on starts bundled `tailscaled` (TUN + MagicDNS `--accept-dns`) against the provisioned Headscale control URL — same model as the Nas host node `os`. Thaali reaches `*.dadi` through a local `/@host` proxy that queries MagicDNS (`100.100.100.100`) so Compose `/etc/hosts` loopbacks cannot hijack service names. On macOS, join also writes `/etc/resolver/dadi` → `100.100.100.100` so Terminal `ssh user@os.dadi` uses MagicDNS (libc will not). macOS prompts for admin (osascript); Linux uses `pkexec`/`sudo`; Windows elevates via UAC for Wintun.
- Leave → `tailscale down`; mesh names stop resolving

Header shows ONLINE / JOINING… / OFFLINE.

Connect on desktop is device-wide: after join, a normal terminal `ssh user@os.dadi` works.

### Desktop success check

**macOS / Windows / Linux** (same power button → `tailscaled` TUN):

1. Fresh Thaali → provision → power on (approve admin / UAC / polkit once if prompted).
2. MagicDNS works: `ping os.dadi` (or `ping os.dadi` from PowerShell / `Get-Command` DNS resolve).
3. `ssh user@os.dadi` from a terminal while Thaali is connected.
4. Thaali header ONLINE against mesh services; power off → SSH to `os.dadi` fails again.

**Windows notes:** CI bundles `tailscale.exe`, `tailscaled.exe`, and `wintun.dll`. First join triggers UAC so Wintun can create the adapter.

### Desktop system mesh binaries

```sh
cd net && ./build-tailscale.sh          # host platform → src-tauri/bin/<target>/
cd net && ./build-tailscale.sh all      # all desktop targets (CI)
```

Pin is `TS_VER` (default `v1.82.0`). Required before `tauri build` / `tauri dev` on desktop.

## Chrome and routes

Glass header + chat sidebar; `<Outlet />` swaps. Routes: `/`, `/agents`, `/memory`, `/timeline`, `/system`, `/chaavi`, `/ghar`.

## Agents / chat / memory

Agents and memory render through `shared/components/ForceGraph` (one d3-force-3d simulation per view, positions kept across polls, new nodes spawn beside a node they link to). Each graph opens with a bloom (`ForceGraph/reveal.ts`: seeds grow in place, then each ring of neighbors sprouts along its link). Hover previews a node's details (`shared/hooks/useHoverDetails`) in a glass `Popover` that sits clear of the node, glides between nodes, and fades away when the pointer leaves the hover zone (node, panel, and the gap between, `Popover/zone.ts`); the agent popover prefetches detail and activity on hover and holds its first open until they load (at most 250 ms) so it appears at full size, and content that arrives later (new activity rows) eases in with the `REVEAL` preset (`shared/lib/ux/motion.ts`). Chat previews and popover text render markdown through `shared/components/Markdown.tsx` (`MarkdownBody`, and `InlineMarkdown` for one-line previews). The Yaad popover (`features/memory/MemoryPopover.tsx`) shows the body, when a node happened, was remembered and recalled, and its connections, each of which focuses its node. Click focuses it (`ForceGraph/focus.ts`): on `/memory` every link touching it lights up, on `/agents` the link to its parent and everything downstream light up generation by generation; edges gain annotations, the camera frames the lit set, unrelated nodes fade, and orbiting keeps the focus; zooming or a background click drops it. Pages that search render `shared/components/SearchField` into the `PageHeader` trailing slot: on the graphs it highlights and frames matches and flies to a lone match; on `/ghar` it narrows rooms and devices (`features/ghar/house/search.ts`) and sits beside New room. Graphs show `shared/components/GraphPlaceholder` (a constellation in the graph palette) while loading, empty, offline, or failed. `/agents` and the home Agents tile (desktop) draw the agent forest in 3D: top-level threads on an inner shell, sub-agents on outer shells toward their parent (`features/agents/tree.ts`); the tile is the same scene without orbit or details; clicking an agent node there opens `/agents` focused on it. Chat sidebar loads durable human↔agent history from Hath `GET /threads` and `GET /agents/:id/messages`, then keeps the open thread live via SSE. Dual-lane busy rules and provisional new-chat routing live under `chrome/chatSidebar/` and `store/chat.ts`. Memory/timeline call Yaad via `shared/api` (`yaad` client; paths live in `shared/api/yaad`). `/timeline` (`features/timeline/`) pages weeks and months with a shared `Glider` (`shared/components/Glider.tsx`, also the log explorer's): pages slide the way time moved, week columns cascade and month squares wash in diagonally, today breathes and carries a now marker, and a Next up pill counts down to the next plan. Memories that happened show under each day (dots on the month). Clicking any entry opens `NodePopover` (rename, plan status, delete via Yaad `PATCH`/`DELETE /nodes/:id`, connections, and Open in Yaad → `/memory?focus=<id>`, which seeds and focuses that node). + on a day or Add opens `QuickAdd`, which sends the text to Yaad `POST /ingest` (prefixed with the day) and shows a ghost chip until it lands. `/memory` (titled Yaad) draws Yaad `POST /graph` as a 3D force-directed network (forces in `features/memory/graph.ts`); every non-memory node is labelled. `/chaavi` is the login password manager (search, reveal/copy, create, edit, delete) over `http://chaavi.dadi/v1`; Vaultwarden remains the encrypted store. Browser autofill uses the Bitwarden extension at `https://chaavi.dadi`. Desktop join fetches `GET /ca` from nas.dadi and installs the mesh CA so the extension trusts that HTTPS endpoint.

## Design tokens

Bone glass — field bloom, frosted veil panels, sage accent; dark palette via `prefers-color-scheme`. Tokens in `src/styles/tokens.css` (same language as dadiOS). Fonts under `src/assets/fonts/`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm test` | Vitest behavior suite |
| `npm run build` | `tsc` + Vite production build |
| `npm run dev` | Vite web client (`0.0.0.0:8080`, `thaali.dadi` allowedHosts) |
| `npm run tauri dev` | Desktop Tauri app (requires `net/build-tailscale.sh` first) |
| `cd net && ./build-tailscale.sh` | Build desktop `tailscale`/`tailscaled` into `src-tauri/bin/` |
| `npx tauri icon app-icon.png` | Regenerate desktop icons from `app-icon.png` (દાદી mark) |

### Desktop auto-update

Tauri desktop builds (Windows / macOS / Linux) check `https://github.com/dadi-os/thaali/releases/latest/download/latest.json` via the updater plugin. Artifacts are signed with `TAURI_SIGNING_PRIVATE_KEY` (see `.env.github`). When a newer SemVer is available, the header shows **UPDATE** — install is explicit, then the app relaunches. Browser Hath has no native updater.

Thaali updates outside `bootc` / `podman-auto-update` as a native binary by design; the web container is for Nas compose / CI only.

# Thaali

The desktop app for dadi: macOS, Windows, and Linux, plus a browser build. Thaali is its internal name; people see **dadi** (app name, window title, wordmark). Future modules ship as pages inside Thaali; the iPhone has its own native client (Khisso). Thaali has no application-level authentication — reaching mesh services requires a provisioned tailnet node (Tauri) or mesh-reachable browser (dev web).

## Dependencies

- Nas (`http://nas.dadi`) — provision, status, logs, module config
- Hath (`http://hath.dadi`) — agents, messages, events
- Yaad (`http://yaad.dadi`) — memory graph
- Chaavi (`http://chaavi.dadi` API, `https://chaavi.dadi` Bitwarden) — full password manager over Chaavi's `/v1` (logins with TOTP and passkeys, notes, cards, identities, SSH keys, custom fields, folders with drag-and-drop); extension for browser autofill
- Ghar (`http://ghar.dadi`) — rooms and Matter devices
- Dwar (indirect via Hath/Yaad)
- The dadi network (system `tailscaled` TUN + MagicDNS)
- Markdown: `streamdown` with `@streamdown/code` (Shiki), `@streamdown/math` (KaTeX, whose CSS is imported directly) and `@streamdown/mermaid`, pinned to exact versions; `react-markdown` + `remark-gfm` for one-line previews

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
        thread/ message/ list.tsx composer.tsx
        format.ts lanes.ts constants.ts ActivityPulse.tsx
    shared/
      api/                 transport + domain clients (hath/, yaad/, nas/)
        constants.ts       mesh URLs (no env fallbacks)
        transport.ts       Transport + ConnectionState
        browser-transport.ts  fetch + EventSource (web / nas compose)
        mesh-transport.ts     MeshTransport / the dadi network (Tauri; dynamic import)
        runtime.ts         isTauriRuntime / transport kind
        sse.ts / credentials.ts
        hath/ yaad/ nas/ chaavi/ ghar/ portable client modules
      lib/
        platform/          logging, clipboard, notifications, downloads
        content/           attachments, branded QR
        ux/                motion (incl. REVEAL preset), poll intervals, time formatting
      components/          IconButton, Popover/ (index + hover zone), ForceGraph/, Tooltip, WidgetFrame
      hooks/               useConnection, useEvents, useLiveQueries, useHoverDetails, useThemeTokens
    store/                 chat, connection, drafts, running, desktopShell
    types/                 API contracts per service (hath, yaad, chaavi, ghar) + d3-force-3d.d.ts
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
| `CHAAVI` | `http://chaavi.dadi` (`/v1` API) |
| `CHAAVI_VAULT` | `https://chaavi.dadi` (Bitwarden clients; mesh CA) |

Plain HTTP on the WireGuard mesh. No localhost fallback.

## Provisioning

On the box: **Preferences → Devices** mints a Nas `POST /provision` setup QR. The bundle embeds the live LAN Headscale URL (`http://<lan>:8080`). New Tauri Thaali: paste the code (or scan it with the camera) on that LAN → connect to dadi. Credentials store in app data. Browser Thaali has no provisioning.

Upgrading from the app when it was named Hath: the bundle ID is now `com.dadi.thaali`, so its app data (credentials) starts empty; add this computer as a device again. The first connect boots out and deletes the old `com.dadi.hath.sysmesh` LaunchDaemon so only one `tailscaled` owns the TUN.

## Window, menus and background

Closing the window hides it; the app keeps running so this device stays online for Hath's `device_*` tools, and the webview is never suspended while hidden (`backgroundThrottling: "disabled"`, macOS 14+). Reopen it from the Dock on macOS, the tray on Windows, or by launching dadi again (single-instance). Quit (Cmd/Ctrl+Q) exits the app; the system `tailscaled` stays connected either way, so `*.dadi` and `ssh os.dadi` keep working. Only Leave mesh (the power button) takes this device off dadi.

macOS and Linux get the dadi menu bar (Edit is macOS-only); Windows, which has no menu bar, gets the notification-area tray.

## Transport / the dadi network

Service data stays fresh from event streams, not timers: Hath's `/events` refetches agents and schedules (`useEvents`), and each service in `LIVE_SOURCES` (`shared/hooks/useLiveQueries.ts`; Yaad, Chaavi, Ghar and Nas) has its stream say `changed`, which refetches the queries under its keys, with a refetch on every reopen and when the window becomes visible again since the streams have no replay. Chaavi and Ghar are followed the same way, and Nas announces only its browser and terminal lists; the System page's status, clients and logs, a busy agent's activity and the live terminal capture are live readings and still poll. All network calls go through a `Transport` (`shared/api/`). Tauri loads `MeshTransport` (dynamic import); the browser loads `BrowserTransport` (fetch + EventSource, Nas `/health` for ONLINE/OFFLINE). Media the webview loads itself (attachment images) takes its URL from `Transport.mediaUrl` (the `/@host` proxy under Tauri). Nas's H.264 browser stream is read through `Transport.openStream` (Tauri's HTTP client, so it never queues behind the webview's per-host connection limit) by `features/agents/browserStream.ts`: one watched connection per browser and profile shared by every view with it (960 px at 5 fps to watch, 1280 px at 30 fps in the expanded view), split into frames by `features/agents/h264.ts`, decoded with WebCodecs (macOS and Windows webviews; Linux WebKitGTK may not decode it, and then the preview shows the error) and drawn on canvases, reconnecting on a logged, bounded backoff when it errors, ends or stalls. Browser Thaali is for Nas compose on-box UI only — it does not join Headscale.

Lifecycle (Tauri):

- Onboarding (`chrome/onboarding/`, stages in `stage.ts`) covers the rail and pages on the field bloom (`shared/components/FieldBloom.tsx`) until this device is on dadi, with one દાદી (`shared/components/Wordmark.tsx`) laid out once at its largest size that glides and scales between stages and never re-lays out. Launch → the wordmark breathes while the saved code is read (an unreadable `credentials.json` is the Can't reach dadi card)
- Unprovisioned → દાદી resolves cluster by cluster, then the glass paste card (Join dadi, a dashed setup-code field, Join; paste anywhere also joins), with Scan the code instead for the camera; a join that fails returns to the card with its error
- Provisioned + mesh down → Connect to dadi (one tap joins; no silent auto-start) with Forget this device at the foot; joining → the wordmark breathes over Connecting to dadi; a failed join → the glass Can't reach dadi card with the real error, Try again and Forget this device. Reduced motion holds the field still and skips the resolve, breath and glide
- Connected → app UI; chrome power control leaves the mesh
- Power on starts bundled `tailscaled` (TUN + MagicDNS `--accept-dns`) against the provisioned Headscale control URL — same model as the Nas host node `os`. Thaali reaches `*.dadi` through a local `/@host` proxy that queries MagicDNS (`100.100.100.100`) so Compose `/etc/hosts` loopbacks cannot hijack service names. On macOS, join also writes `/etc/resolver/dadi` → `100.100.100.100` so Terminal `ssh user@os.dadi` uses MagicDNS (libc will not). macOS prompts for admin (osascript); Linux uses `pkexec`/`sudo`; Windows elevates via UAC for Wintun.
- Leave → `tailscale down`; mesh names stop resolving
- Forget this device (Dadi menu on macOS/Linux, the tray on Windows, and the can't-connect screen; always confirmed) → `mesh_forget`: `tailscale down` through thaali's own socket, the proxy stops and `credentials.json` is deleted, so onboarding asks for a fresh setup code. It never runs `tailscale logout`, which asks the control server and fails for a node the box already deleted; the next join's `up --force-reauth --reset` replaces the old identity. A `down` that fails is shown on the confirmation and nothing is cleared.

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

Glass header + chat sidebar; `<Outlet />` swaps. The header's દાદી is the shared `Wordmark` (ink-centered Noto Sans Gujarati), which breathes, a sage glow and a 0.98 ↔ 1.02 scale every 2.4 s, wherever dadi waits: in the header while the mesh reconnects, on Talk to Dadi while a message is routed, and on onboarding while launching and joining. Routes: `/`, `/hath`, `/yaad`, `/timeline`, `/system`, `/chaavi`, `/ghar`.

## Agents / chat / memory

Agents and memory render through `shared/components/ForceGraph` (one d3-force-3d simulation per view, positions kept across polls, new nodes spawn beside a node they link to). Each graph opens with a bloom (`ForceGraph/reveal.ts`: seeds grow in place, then each ring of neighbors sprouts along its link). Hover previews a node's details (`shared/hooks/useHoverDetails`) in a glass `Popover` that sits clear of the node, glides between nodes, and fades away when the pointer leaves the hover zone (node, panel, and the gap between, `Popover/zone.ts`); the agent popover prefetches detail and activity on hover and holds its first open until they load (at most 250 ms) so it appears at full size, and content that arrives later (new activity rows) eases in with the `REVEAL` preset (`shared/lib/ux/motion.ts`). Replies, popover text and Markdown files render through `shared/components/Markdown.tsx`: `MarkdownBody` is [Streamdown](https://github.com/vercel/streamdown) in static mode (replies reach the desktop whole, so unterminated syntax is not repaired) with CommonMark + GFM (tables, task lists, strikethrough, autolinks), KaTeX math (inline `$…$` and `\(…\)`, display `$$…$$` and `\[…\]`; `shared/lib/content/math.ts` rewrites them to the `$$` remark-math reads, leaving code alone, and single-dollar math is off so a `$…$` is math only when it reads as LaTeX, with a `\`, `^` or `_` and no space or digit just inside, which keeps prices like $412 or $5 and $10 as text), Shiki-colored code fences in vitesse light and dark with the OS scheme, and Mermaid diagrams in thaali's tokens; Shiki and Mermaid are imported with the first code block or diagram, and every element keeps the `.chat-md` typography. `InlineMarkdown` stays a plain react-markdown render of spans for one-line previews. The Yaad popover (`features/memory/MemoryPopover.tsx`) shows the body, when a node happened, was remembered and recalled, and its connections, each of which focuses its node. Click focuses it (`ForceGraph/focus.ts`): on `/yaad` every link touching it lights up, on `/hath` the link to its parent and everything downstream light up generation by generation; edges gain annotations, the camera frames the lit set, unrelated nodes fade, and orbiting keeps the focus; zooming or a background click drops it. Pages that search render `shared/components/SearchField` into the `PageHeader` trailing slot: on the graphs it highlights and frames matches and flies to a lone match. `/ghar` (`features/ghar/`) is rooms first, with a tile as the only card: headers, chips, bars and switches sit straight on the page. The header is the house's headline ("2 of 3 lights on") with All off, Evening (every reachable light to a 2700 K warm white, then 40%, which turns it on; computed on this computer in `model.ts`) and Add a device (the pairing sheet, `commission.tsx`). Chips filter to Everywhere, a room or a group (a Ghar tag), and New room creates a room. Each room is a section: its name and status ("2 of 3 on · Warm white, peach"), a brightness bar that fills with its lit lights' mixed color and sets every light when dragged, and a room switch, over a four-across grid of tiles ending in Add a device here; a group shows the same header over the devices carrying its tag. A lit tile takes its light's real color and brightness (the fill and border strengthen with brightness, about 32% and 90% at 80%, and the icon disc is the full color: a white from its color temperature, a hue at full value from hue and saturation, by the reported color mode or else the reading that changed last), and an off tile is quiet with a hairline. Clicking a tile switches it; a long press, a right click or its controls button selects it into the inspector on the right, the page's one panel: the name (click to rename, `PATCH /devices/:id {name}`), its switch, a tall brightness pill, Warmth and Color gradient sliders and one-tap presets, then Room (`PATCH {room}`) and Groups (`PATCH {tags}`, with New group) pickers. A room's options rename it, move devices into it, or delete it (its devices go to Unplaced first, since Ghar refuses to delete a room that still has devices) through Ghar's `/rooms` routes, and any Ghar error is shown above the chips until the next success or Dismiss. Commands run per device in order and their result shows as soon as Ghar accepts them (`useHouse.ts` writes the accepted state into the `["ghar", "devices"]` query), and Ghar's `/changes` stream keeps the page live with no polling. A toast's `?device=` selects that device into the inspector. The home Ghar widget sits straight on its widget card: how many lights are on and in which rooms, a switch for every light, a chip per light that switches it, and a brightness bar that sets them all (`features/ghar/widget.tsx`). Graphs show `shared/components/GraphPlaceholder` (a constellation in the graph palette) while loading, empty, offline, or failed. `/hath` and the home Hath tile (desktop) draw the forest of active agents in 3D (inactive agents are left out, and a sub-agent of an inactive parent becomes a root): top-level threads on an inner shell, sub-agents on outer shells toward their parent (`features/agents/tree.ts`); the tile is the same scene without orbit or details; clicking an agent node there opens `/hath` focused on it. Chat sidebar loads durable human↔agent history from Hath `GET /threads` and `GET /agents/:id/messages`, then keeps the open thread live via SSE. Retired agents are never listed (Hath leaves them out of `/threads`, and an `agent_modified` event that retires one drops its row), and a retired agent's thread has no composer. Dual-lane busy rules and provisional new-chat routing live under `chrome/chatSidebar/` and `store/chat.ts`. The list groups chats by day, each row the agent's name, last message and when it came (`formatListTime`); a busy chat stays in its place, showing the flowing dots while its agent's process lane runs and the working sheen across the row while its work lane runs. Previews follow SSE and are refreshed from `GET /threads` every 30 s and when the window comes back into view (`mergeConversations` keeps whichever summary is newer), since SSE has no replay. An open pane's header is the chat's name as a glass bubble (દાદી for Talk to Dadi); an agent's bubble opens its popover. The glass pill over the composer is the one place a thread shows what its agent is doing (`LaneChip.tsx`), at two levels: processing (the process lane, reading what arrived and answering it) plays three dots inside the pill that flow left to right, dipping off the end and reappearing (`ProcessingMark`), and working (the work lane, doing the job) runs a sheen on the pill itself (`.lane-sheen`: one turning angle drives a beam through the glass and a ring round its edge). Every message shows when it was sent and a copy button, code blocks in replies have their own copy button (`shared/components/CopyButton.tsx`), and a reply that arrives while its thread is open enters as finished markdown with a fade, rise and top-to-bottom wipe rather than typing out. Files travel as Hath attachments: the composer takes picked, pasted and dropped files (Tauri's own drag-drop is off so the webview gets drops), and a paste over 4,000 characters becomes a `pasted-text.txt` attachment instead of draft text (`shared/lib/content/attachments.ts`); a message shows its files as image thumbnails or name-and-size chips (`chrome/chatSidebar/message/files.tsx`, served from Hath `GET /attachments/:id`), and any file opens in `FileViewer.tsx` over the frosted window: one sheet with the file's name, kind and size, copy (text), download (Tauri's `save_download` writes it into Downloads and reveals it) and close, over the image, the PDF, the code colored by its language with line numbers (Shiki, loaded on first use with only the grammar the file needs), rendered Markdown (`text/markdown`, `.md` or `.markdown`, through `MarkdownBody`) with a source toggle, or a download card for other files. Picked files are typed by extension first, so source code (`.ts` included, which platforms call video/mp2t) is stored as text. The host pin above a thread shows the agent's live browser and a live terminal (`features/agents/TerminalScreen.tsx`, re-capturing Nas `GET /terminals/:id/capture` every second while visible); clicking either blows it up, frameless, over the frosted window (the browser as an exact 16:9 view). The expanded browser is also a remote control for captchas and the like: clicks, drags, scrolls and keys on it go to Nas `POST /browsers/:id/input` as CDP input (`features/agents/browserInput.ts`, one request in flight so order holds), with no lock, so the agent keeps working beside you. An agent's message to you never switches chats: unless its chat is open it toasts, and clicking the toast opens it. Unread counts are Hath's, so the desktop and the phone show the same badges: each row's count (a bolder name, a sage time and the count) comes from `GET /threads`, a reply raises it live unless it lands in the chat that is open in a visible window (notices are never counted), and a `thread_read` event from any device takes Hath's new count; marks only move forward, so an older summary or mark never undoes a newer one (`store/chat.ts`). The open chat is marked read through its newest message with `POST /agents/:id/read` when it opens, when a reply lands in it and when the window comes back into view (`chrome/chatSidebar/useMarkRead.ts`); a failed mark is logged as `thread_read_failed` and toasted. While the window is hidden or unfocused it also raises a native notification (`shared/lib/platform/notify.ts`, `tauri-plugin-notification`); a refused permission is logged as `notification_failed`. Memory/timeline call Yaad via `shared/api` (`yaad` client; paths live in `shared/api/yaad`). `/timeline` (`features/timeline/`) pages weeks and months with a shared `Glider` (`shared/components/Glider.tsx`, also the log explorer's): pages slide the way time moved, week columns cascade and month rows wash in diagonally, all-day and multi-day plans run as bars along the top of their days (the month lists each day's timed plans under them, with +N more opening its week), today breathes and carries a now marker, and a Next up pill counts down to the next plan. Memories that happened show under each day (dots on the month). Every view reads Yaad `POST /timeline` (`shared/api/timeline`): the planner is a filter over plans, not a store of its own. The Planner view (`features/timeline/planner/`, the page's default; the home tile opens `/timeline?view=week`) is one day drawn straight on the page with no panel around it: the weekday large with, on today, what is happening now and what is next beneath it, then the day's timed sessions (view `planner`) on an hour axis, each as tall as its time (commitments solid, the gym warm, routines quiet, cancelled ones struck through) with the time between them left open (named when it is 30 minutes or more); each session is one row of title and time range with its body under it, and on a wide window a column on the right stays in view with what is happening now (time left and a progress line) and what is next, the day's sessions with their lengths, and the first sessions of the next day (the query covers the shown day and the one after). Week reads the `planner` and `tile` views together, Month the `month` view (dues, all-day and multi-day sessions, one-off commitments), the Someday rail the `someday` view (ideas, and tasks that need a time), and the home tile's ribbon the `tile` view (commitments only); the Month grid gives each week row a share of its height and folds what does not fit into +N more, so it never scrolls. A session opens a card (planner) or `NodePopover` (elsewhere: when, its state, series count and place, body, connections, and Open in Yaad → `/yaad?focus=<id>`) with the only write the app makes, Completed (`PUT /timeline/outcome`, done or taken back), and Message <owner>, which opens the chat of the agent that keeps it (Tell Dadi when no agent does); Tell Dadi in the header opens the Dadi composer. Nothing on the timeline edits or deletes a plan: agents change it through memory ingest. `/yaad` draws every node and edge from Yaad `POST /graph` as a 3D force-directed network (forces in `features/memory/graph.ts`); every non-memory node is labelled. `/chaavi` is the login password manager (search, reveal/copy, create, edit, delete) over `http://chaavi.dadi/v1`; Vaultwarden remains the encrypted store. Browser autofill uses the Bitwarden extension at `https://chaavi.dadi`. Desktop join fetches `GET /ca` from nas.dadi and installs the mesh CA so the extension trusts that HTTPS endpoint.

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

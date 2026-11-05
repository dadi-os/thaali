# Thaali

The desktop app for dadi: macOS, Windows, and Linux. Thaali is its internal name; people see **dadi** (app name, window title, wordmark). Future modules ship as pages inside Thaali; the iPhone has its own native client (Khisso). Thaali has no application-level authentication — reaching mesh services requires a provisioned tailnet node.

## Dependencies

- Nas (`http://nas.dadi`) — provision, status, logs, module config, helper tasks (`/tasks`) and their live browser and terminal views
- Hath (`http://hath.dadi`) — agents, messages, events
- Yaad (`http://yaad.dadi`) — memory graph
- Chaavi (`http://chaavi.dadi` API, `https://chaavi.dadi` Bitwarden) — full password manager over Chaavi's `/v1` (logins with TOTP and passkeys, notes, cards, identities, SSH keys, custom fields, folders); extension for browser autofill
- Ghar (`http://ghar.dadi`) — rooms and Matter devices
- Dwar (indirect via Hath/Yaad)
- The dadi network (system `tailscaled` TUN + MagicDNS)
- Markdown: `streamdown` with `@streamdown/code` (Shiki), `@streamdown/math` (KaTeX, whose CSS is imported directly) and `@streamdown/mermaid`, pinned to exact versions; `react-markdown` + `remark-gfm` for one-line previews

## Layout

A page is a composition of shared parts: a fix in `shared/` reaches every page. `pages/` and `features/` hold what is specific to one place.

```
thaali/
  src/
    App.tsx, main.tsx       routes + boot (installs the interaction layer)
    pages/                  route construction sites: Page + a header + nouns
    features/<domain>/      data hooks, derivations and flows owned by one place: agents, chat (the chat rail), chaavi, ghar, home (the Tile frame), logs, memory, onboarding (setup code, provisioning, forget device), system, timeline
    contexts/               app-wide state every layer assumes: connection, running lanes, chat, drafts, toasts, takeover, dock requests, the desktop shell
    shared/
      ui/                   primitives with no domain knowledge: Button, IconButton, Pill, Segmented, Chip, Switch, Icon (the one icon set), Card, Badge, Skeleton, Truncate, AgentName, Disclosure, CopyButton
      overlay/              everything that floats, on one dismiss stack: Dialog, ConfirmDialog, LargeDialog, Sheet, MenuSurface (the one menu), AnchoredMenu, ContextMenuHost, Popover, Tooltip, Toast
      interaction/          the desktop input system: scroll edge fades, scoped select all, the one context menu (useContextActions), Action lists, shortcuts, the dismiss stack
      motion/               the only place a duration, easing, spring or enter/exit shape is chosen
      layout/               Page (frame, side panel dock or drawer), Measured, shell/ (AppShell, TitleBar, WindowControls, PageHeader, OfflinePill, Toaster), Wordmark, FieldBloom
      states/               loading, offline, module-offline, error, empty and stale views, ErrorBoundary
      components/           domain nouns drawn once and varied by props: Task (TaskView, TaskRow, TaskStatus), Thread (conversation list, messages, composer), Graph, Markdown
      desktop/              every operating-system call: clipboard, opener, downloads, notifications, owner check, tray, updater, device remote, OS detection
      api/                  transport + domain clients (hath/, yaad/, nas/, chaavi/, ghar/, timeline/); mesh-transport.ts is the production transport
      hooks/ lib/           shared hooks and pure TypeScript (content, ux helpers, time)
      theme/                the only CSS: tokens, base (input policy), scroll fades, primitives and a file per module
    dev/                    dev-only fixture transport, typed fixtures and the gallery the fidelity gate renders (never in the production bundle)
    types/                  API contracts per service (hath, yaad, chaavi, ghar, timeline) + d3-force-3d.d.ts
  src-tauri/                Rust shell + logutil
  net/                      Tailscale CLI build for the desktop mesh
  visual/                   the visual loop (WKWebView snapshot tool, DOM checks, runner) and fidelity/, the gate that holds the app to the design
  Dockerfile                web container (dev Vite / production static): scheduled for removal with the browser build
```

### Rules the structure keeps (src/architecture.test.ts holds the mechanical ones)

- The window is chrome: text is not selectable unless it is marked `data-selectable` (content people read or copy) or is a text field. Select all selects the region under the pointer, never the interface.
- Every control gets its pointer, hover, focus and pressed state from `theme/base.css`; no component re-implements them.
- A right-click menu is offered only through `useContextActions`; each noun declares its actions once (`planActions`, `deviceActions`, `itemActions`, `taskActions`, `agentActions`) and the same list serves the context menu and any click menu.
- Escape and outside presses close only the topmost overlay, through `useDismiss`.
- Anything that appears or disappears after the first paint animates through the presets in `shared/motion`; no component writes a duration or easing.
- No scrollbar draws; a scrolling region (`className="scroll"`) fades the edge that has more content.
- The type scale is 11, 12, 13, 14, 15, 17, 20, 28, 34 px and radii are even.

## Config vs env

Mesh addresses are **constants** in `shared/api/constants.ts` — no URL env fallbacks. The desktop OS (window chrome) comes from `@tauri-apps/plugin-os`. Optional `THAALI_LOG_FILE` appends Rust JSON logs for Alloy (Tauri only).

Signing / release secrets live in `.env.github` for CI only — not application runtime.

## Local run

Prerequisites once: `npm install`, then `cd net && ./build-tailscale.sh && cd ..`.

### Desktop (Tauri)

```sh
npm run tauri dev
```

`device_get_location`: macOS asks for Always (`NSLocationAlwaysAndWhenInUseUsageDescription` in [src-tauri/Info.plist](src-tauri/Info.plist)); Windows uses WinRT Geolocator (coords + coarse civic address, no Maps API key).

### Visual loop

Every page can be loaded against typed fixtures instead of the mesh, and captured in the engine the desktop app uses (WKWebView on macOS).

```sh
npm run dev -- --config vite.visual.config.ts   # then open http://127.0.0.1:5174/hath?fixtures=asking
npm run visual -- --out /tmp/thaali-visual       # every page x scenario at 1440 wide, with DOM checks
npm run visual -- --out <dir> --pages hath,system --scenarios normal,asking --widths 900,1440,1920,1080x1920 --interact
npm run visual -- --out <dir> --flow chaavi      # the scripted flows whose name starts with chaavi: browse, the new-item sheet, the delete dialog
```

- `?fixtures=<scenario>` (dev server only) swaps the transport for `src/dev/fixtureTransport.ts`. Scenarios: `normal`, `loading` (requests never answer), `offline`, `blip` (connected, then the mesh drops after 4 s), `module-offline` (Ghar, Yaad and Chaavi answer 502), `errors` (every request fails), `empty`, `long` (long names, messages and paths), `many` (about 120 agents, 40 tasks, 1,800 memory nodes), `asking` (a helper task waiting on its agent) `tasks-error` (only Nas's task list fails) and `errors-error` (only Nas's recent errors fail).
- Fixture data is typed against `src/types` and the API client types, so a changed contract fails `tsc`. Strings take their length and shape from real responses read from the box; the committed fixtures are synthetic.
- A request no fixture route answers throws, so a missing fixture shows as a console error in the report. `window.__fixtures.emit(host, path, event)` pushes an event onto a fixture event stream (a toast, a live refetch).
- `visual/snap.swift` loads each URL in a WKWebView at a size, runs steps (click, hover, wait, screenshot, checks) and records console errors. `visual/checks.js` reports text clipped without an ellipsis or a title, flex children missing `min-w-0`, content spilling its box, elements past their parent, targets under 32 px, controls with no accessible name, text under WCAG contrast, percentage `max-height`s, nested scroll containers, interactive elements with no transition, and elements that mount with no motion after `__mountSince`.
- The output directory gets `shots/*.png` (2x), `results.json` and `report.md`. `--interact` also captures an expand at 120 ms and 640 ms and a hover.
- Limits: WKWebView snapshots do not render `backdrop-filter`, so glass blur (popovers, toasts, the sidebar) shows as plain translucency; judge glass legibility in the running app. The capture window sits on screen at 1% opacity because a hidden window stops animations. The mesh-only dialogs (onboarding, provisioning, forget device), the tray menu and live browser frames (the H.264 stream is not synthesized; the frame shows its caption) are not captured.

### Fidelity gate

The app is held to the Thaali design artifact rather than to a description of it. The design's generator (outside this repo) writes one plain-HTML reference page per case, a primitive in one state or a whole page board; the app renders the same case from `src/dev/gallery` (a primitive) or its own route (a page). The gate loads both in a WKWebView at 2x and compares them.

```sh
DESIGN_REF_DIR=<the generator's site/ directory> npm run fidelity -- --out <dir>
DESIGN_REF_DIR=<...> npm run fidelity -- --out <dir> --cases button.,toast.info
```

- `DESIGN_REF_DIR` is required: the generator's `site/` directory, which holds `gate/manifest.json`, `gate/<case>.html` and `fonts/`. The machine must be in a zone that follows America/New_York (the design pins it). Exits 1 when any case frame fails.
- A frame passes when no pixel differs by more than `channelTolerance` (2 of 255: the gradient animations differ by that much between two renders of the same CSS) and the element trees match: tag, own text, accessible attributes, box (x, y, width, height within `boxTolerance`) and every computed style in `visual/fidelity/hook.js`'s list, element by element, with `::before` and `::after` content. `ignoreProps` in `visual/fidelity/thresholds.json` lists what is excluded and why: `backdrop-filter` (the design's renders cannot draw glass, the app's cards blur) and `animation-name` (keyframe names are namespaced per codebase; the keyframes are compared by the frames below).
- A case may force `:hover`, `:active` and focus states (the gate copies those rules onto classes and puts the class on the element and its ancestors), add a class to start a transition (`toggle`), and name `times` in ms: the gate then seeks every running animation and transition to each time, deterministically, and compares a frame at each. Animations are otherwise finished (infinite ones held at their start) before a frame is taken.
- `--out` gets `report.md` and `report.json` (every case frame with its pixel diff, its DOM differences and console errors), `shots/` (design, app and heatmap images) and `failures/` (the design and app images of every failing frame). A page case's `appPath` is the app route (with its `?fixtures=` scenario) and `root` names the element to compare on each side (the pixel comparison covers only that element's rect, so a case that names the rail compares the rail and not the page around it; a page gets 5 s to load and settle, since four snapshot tools at once slow it); `__clock` in the URL pins `Date` on both sides to the instant the case names, and `__rail=<px>` saves the rail width a page case starts with.
- The gate is dev tooling like the visual loop: `visual/fidelity/` and `src/dev/gallery` are not in the production bundle.

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
| `ci.yml` → `ci` | PR + push to `main` | `npm test`, Timeline tests again in `America/New_York` for daylight saving transitions, `npm run build` |
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

Service data stays fresh from event streams, not timers: Hath's `/events` refetches agents and schedules (`useEvents`), and each service in `LIVE_SOURCES` (`shared/hooks/useLiveQueries.ts`; Yaad, Chaavi, Ghar and Nas) has its stream say `changed`, which refetches the queries under its keys, with a refetch on every reopen and when the window becomes visible again since the streams have no replay. Chaavi and Ghar are followed the same way, and Nas announces only its browser and terminal lists; the System page's status, clients and logs, a busy agent's activity and the live terminal capture are live readings and still poll. All network calls go through a `Transport` (`shared/api/`). Tauri loads `MeshTransport` (dynamic import); the dev server's `?fixtures=` mode loads the fixture transport for the visual loop, and any other start outside Tauri fails loudly. Media the webview loads itself (attachment images) takes its URL from `Transport.mediaUrl` (the `/@host` proxy under Tauri). Nas's H.264 browser stream is read through `Transport.openStream` (Tauri's HTTP client, so it never queues behind the webview's per-host connection limit) by `features/agents/browserStream.ts`: one watched connection per browser and profile shared by every view with it (960 px at 5 fps to watch, 1280 px at 30 fps in the expanded view), split into frames by `features/agents/h264.ts`, decoded with WebCodecs (macOS and Windows webviews; Linux WebKitGTK may not decode it, and then the preview shows the error) and drawn on canvases, reconnecting on a logged, bounded backoff when it errors, ends or stalls.

Lifecycle (Tauri):

- Onboarding (`chrome/onboarding/`, stages in `stage.ts`) covers the rail and pages on the field bloom (`shared/components/FieldBloom.tsx`) until this device is on dadi, with one દાદી (`shared/components/Wordmark.tsx`) laid out once at its largest size that glides and scales between stages and never re-lays out. Launch → the wordmark breathes while the saved code is read (an unreadable `credentials.json` is the Can't reach dadi card)
- Unprovisioned → દાદી resolves cluster by cluster, then the glass paste card (Join dadi, a dashed setup-code field, Join; paste anywhere also joins), with Scan the code instead for the camera; a join that fails returns to the card with its error
- Provisioned + mesh down → Connect to dadi (one tap joins; no silent auto-start) with Forget this device at the foot; joining → the wordmark breathes over Connecting to dadi; a failed join → the glass Can't reach dadi card with the real error, Try again and Forget this device. Reduced motion holds the field still and skips the resolve, breath and glide
- Connected → app UI; chrome power control leaves the mesh
- Power on starts bundled `tailscaled` (TUN + MagicDNS `--accept-dns`) against the provisioned Headscale control URL — same model as the Nas host node `os`. Thaali reaches `*.dadi` through a local `/@host` proxy that queries MagicDNS (`100.100.100.100`) so Compose `/etc/hosts` loopbacks cannot hijack service names. On macOS, join also writes `/etc/resolver/dadi` → `100.100.100.100` so Terminal `ssh user@os.dadi` uses MagicDNS (libc will not). macOS prompts for admin (osascript); Linux uses `pkexec`/`sudo`; Windows elevates via UAC for Wintun.
- Leave → `tailscale down`; mesh names stop resolving
- Forget this device (Dadi menu on macOS/Linux, the tray on Windows, and the can't-connect screen; always confirmed) → `mesh_forget`: `tailscale down` through thaali's own socket, the proxy stops and `credentials.json` is deleted, so onboarding asks for a fresh setup code. It never runs `tailscale logout`, which asks the control server and fails for a node the box already deleted; the next join's `up --force-reauth --reset` replaces the old identity. A `down` that fails is shown on the confirmation and nothing is cleared.

The title bar's notice reads Reconnecting to dadi… while the mesh reconnects,.

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

The title bar (`TitleBar.tsx`: a 40 px glass strip that drags the window, the દાદી that takes you home, and the one notice for dadi being out of reach at its right edge) sits over the conversation rail and the page, and `<Outlet />` swaps the page. The rail (`chrome/chatSidebar/`) is a search over agent names, the conversations under the day of their last message, and the router dock; its edge is a separator (`ResizeHandle.tsx`) you can drag, move with the arrow keys (Shift for larger steps, Home and End for the limits) or double-click to reset, between 260 and 560 px and never leaving the main area under 640 px, kept between launches. The dock is Talk to Dadi: there is no screen for it. It grows in one motion from its bar into the composer, settles back to the bar when a message is sent with a ring turning on its glyph while the router runs (from `router_started` / `router_finished` / `router_failed`, each carrying a `run_id`, and `GET /router` for a device that connects mid-run), keeps a draft when a second send must wait, and brings the draft back when a send fails with a toast that says it was copied to the clipboard; Command-K opens it from anywhere and Esc closes it. The wordmark on onboarding is the shared `Wordmark` (ink-centered Noto Sans Gujarati), which breathes, a sage glow and a 0.98 ↔ 1.02 scale every 2.4 s, while launching and joining. Routes: `/`, `/hath`, `/yaad`, `/timeline`, `/system`, `/chaavi`, `/ghar`. Home (`pages/HomePage.tsx`) is six tiles in the named areas of `.home-grid` (`styles/tokens.css`): on a wide window 4 × 4 with Hath and Timeline 2 × 2, Yaad and Ghar 2 × 1, Chaavi and System 1 × 2; 2 × 3 when the main area is under 1000 px (a container query on the page, so a wide rail narrows it too); two columns of five rows on a portrait window. The grid fills the page exactly and nothing scrolls: each tile (`features/home/Tile.tsx`) measures itself and gives its body the room it has, and the body shows as many rows, rooms and bars as fit. A tile that cannot show content says why in its place (`features/home/notice.ts`): dadi unreachable, the service failed (with the request and status) or is not answering (with its host and status), or nothing yet; a failed refetch keeps the last answer.

## Agents / chat / memory

Memory renders through `shared/components/ForceGraph` (one d3-force-3d simulation, positions kept across polls, new nodes spawn beside a node they link to). The graph opens with a bloom (`ForceGraph/reveal.ts`: seeds grow in place, then each ring of neighbors sprouts along its link). `/yaad` (`pages/YaadPage.tsx`) draws every node and edge from Yaad `POST /graph` as a 3D force-directed network (`features/memory/MemoryGraph3D.tsx`, forces in `features/memory/graph.ts`, every kind in the colour of `KIND_TOKEN`) under a chip per kind with its count and a search over node titles; the graph fades what both leave out. `?focus=` names the node to open on and `?kind=` the chip to start on, so the timeline's Open in Yaad and a link open the page on a node. A click on a node focuses it and docks its sheet beside the graph (`NodeSheet.tsx`: its kind, name and body, every node it connects to with the edge's type, and a usage box of figures from the node itself; a drawer over the graph when the page is 900 px wide or less, closed by a click outside it, its close control or `Esc`); a node never opened shows `Never` under Last used. The graph's canvas is hidden on both sides of the fidelity gate and compared by its box, so the page around the scene is held to the design and the scene is not. `/hath` (`pages/HathPage.tsx`) draws the active agents as a flat graph (`AgentGraph2D.tsx`, laid out by `graph2d.ts`: one ring per depth, a node per agent, a line to its parent, a ring that spreads from one that is running, a name beside the nodes that have room for one, and only the roots named past 40 agents) or as a list (`AgentList.tsx`: the tree in order, each agent's state, what it is doing when the card is wide, its helper tasks and when it was last active), under chips that fade the agents a state leaves out, with a legend under the graph. `?agent=` names the picked agent and `?view=list` the list; the thread's details button opens the page on its agent. A click on a node or a row picks the agent and docks its sheet beside the page (a drawer over it when the page is 800 px wide or less, closed by a click outside it or `Esc`); the sheet shows its lanes, what it is doing now (Hath's `running.status`), its helper tasks, last calls, queued messages, schedule, charter (size in tokens, from Hath's measured 2.37 characters per token) and newest wakes, with Open thread for its chat, which a click on the graph never opens. Replies, popover text and Markdown files render through `shared/components/Markdown.tsx`: `MarkdownBody` is [Streamdown](https://github.com/vercel/streamdown) in static mode (replies reach the desktop whole, so unterminated syntax is not repaired) with CommonMark + GFM (tables, task lists, strikethrough, autolinks), KaTeX math (inline `$…$` and `\(…\)`, display `$$…$$` and `\[…\]`; `shared/lib/content/math.ts` rewrites them to the `$$` remark-math reads, leaving code alone, and single-dollar math is off so a `$…$` is math only when it reads as LaTeX, with a `\`, `^` or `_` and no space or digit just inside, which keeps prices like $412 or $5 and $10 as text), Shiki-colored code fences in vitesse light and dark with the OS scheme, and Mermaid diagrams in thaali's tokens; Shiki and Mermaid are imported with the first code block or diagram, and every element keeps the `.chat-md` typography. `InlineMarkdown` stays a plain react-markdown render of spans for one-line previews. Click focuses it (`ForceGraph/focus.ts`): on `/yaad` every link touching it lights up; edges gain annotations, the camera frames the lit set, unrelated nodes fade, and orbiting keeps the focus; zooming or a background click drops it. The search box on `/yaad` highlights and frames matches and flies to a lone match. `/ghar` (`features/ghar/`) is rooms first, with a tile as the only card: headers, chips, bars and switches sit straight on the page. The header is the house's headline ("2 of 3 lights on") with All off, Evening (every reachable light to a 2700 K warm white, then 40%, which turns it on; computed on this computer in `model.ts`) and Add a device (the pairing sheet, `commission.tsx`). Chips filter to Everywhere, a room or a group (a Ghar tag), and New room creates a room. Each room is a section: its name and status ("2 of 3 on · Warm white, peach"), a brightness bar that fills with its lit lights' mixed color and sets every light when dragged, and a room switch, over a four-across grid of tiles ending in Add a device here; a group shows the same header over the devices carrying its tag. A lit tile takes its light's real color and brightness (the fill and border strengthen with brightness, about 32% and 90% at 80%, and the icon disc is the full color: a white from its color temperature, a hue at full value from hue and saturation, by the reported color mode or else the reading that changed last), and an off tile is quiet with a hairline. Clicking a tile switches it; a long press, a right click or its controls button selects it into the inspector on the right, the page's one panel: the name (click to rename, `PATCH /devices/:id {name}`), its switch, a tall brightness pill, Warmth and Color gradient sliders and one-tap presets, then Room (`PATCH {room}`) and Groups (`PATCH {tags}`, with New group) pickers. A room's options rename it, move devices into it, or delete it (its devices go to Unplaced first, since Ghar refuses to delete a room that still has devices) through Ghar's `/rooms` routes, and any Ghar error is shown above the chips until the next success or Dismiss. Commands run per device in order and their result shows as soon as Ghar accepts them (`useHouse.ts` writes the accepted state into the `["ghar", "devices"]` query), and Ghar's `/changes` stream keeps the page live with no polling. A toast's `?device=` selects that device into the inspector. The Home Ghar tile (`features/ghar/GharTile.tsx`) is a card per room (rooms with a light on first, lights that belong to no room last) with how many of its lights are on and, when it is tall enough, the lights themselves, and one switch for every light; rooms are created on the Ghar page. Inactive agents are left out of `/hath`, and a sub-agent of an inactive parent becomes a root. The Home Hath tile (`features/agents/HathTile.tsx`) draws the same agents with the same graph and nothing else: a running agent pulses in its state's colour. Chat sidebar loads durable human↔agent history from Hath `GET /threads` and `GET /agents/:id/messages`, then keeps the open thread live via SSE. Retired agents are never listed (Hath leaves them out of `/threads`, and an `agent_modified` event that retires one drops its row), and a retired agent's thread has no composer. Dual-lane busy rules and provisional new-chat routing live under `chrome/chatSidebar/` and `store/chat.ts`. The list groups chats by day, each row the agent's name, last message and when it came (`formatRailTime`); a chat whose agent has a lane running opens its row with a pulsing dot. Previews follow SSE and are refreshed from `GET /threads` every 30 s and when the window comes back into view (`mergeConversations` keeps whichever summary is newer), since SSE has no replay. An open pane's header is the chat's name as a glass bubble; an agent's bubble opens `/hath` with that agent's sheet docked. The glass pill over the composer is the one place a thread shows what its agent is doing (`LaneChip.tsx`), at two levels: processing (the process lane, reading what arrived and answering it) plays three dots inside the pill that flow left to right, dipping off the end and reappearing (`ProcessingMark`), and working (the work lane, doing the job) runs a sheen on the pill itself (`.lane-sheen`: one turning angle drives a beam through the glass and a ring round its edge). Every message shows when it was sent and a copy button, code blocks in replies have their own copy button (`shared/components/CopyButton.tsx`), and a reply that arrives while its thread is open enters as finished markdown with a fade, rise and top-to-bottom wipe rather than typing out. Files travel as Hath attachments: the composer takes picked, pasted and dropped files (Tauri's own drag-drop is off so the webview gets drops), and a paste over 4,000 characters becomes a `pasted-text.txt` attachment instead of draft text (`shared/lib/content/attachments.ts`); a message shows its files as image thumbnails or name-and-size chips (`chrome/chatSidebar/message/files.tsx`, served from Hath `GET /attachments/:id`), and any file opens in `FileViewer.tsx` over the frosted window: one sheet with the file's name, kind and size, copy (text), download (Tauri's `save_download` writes it into Downloads and reveals it) and close, over the image, the PDF, the code colored by its language with line numbers (Shiki, loaded on first use with only the grammar the file needs), rendered Markdown (`text/markdown`, `.md` or `.markdown`, through `MarkdownBody`) with a source toggle, or a download card for other files. Picked files are typed by extension first, so source code (`.ts` included, which platforms call video/mp2t) is stored as text. The host pin above a thread shows the agent's live browser and a live terminal (`features/agents/TerminalScreen.tsx`, re-capturing Nas `GET /terminals/:id/capture` every second while visible); clicking either blows it up, frameless, over the frosted window (the browser as an exact 16:9 view). The expanded browser is also a remote control for captchas and the like: clicks, drags, scrolls and keys on it go to Nas `POST /browsers/:id/input` as CDP input (`features/agents/browserInput.ts`, one request in flight so order holds). Helper tasks (the agent sheet's rows and the System page's) show a preview of the task's browser or terminal; a click opens the takeover modal (`features/agents/takeover/`, open state in `store/takeover.ts`, drawn by the app frame), where the browser takes pointer, wheel and keys, with Back and Reload (`POST /browsers/:id/navigate`), and the terminal takes a command line (`POST /terminals/:id/keys`). Nas pauses the helper at his first input, so the modal shows the task paused ("You are driving") from then; closing after driving asks whether to resume the loop, resume with a note (`POST /tasks/:kind/:id/resume`) or stop the task (`.../stop`), and `⌘ .` hands back, `Esc` closes before he has driven. `/system` (`pages/SystemPage.tsx`, `features/system/`, `features/logs/`) is the health card (Nas's status as a ring each for CPU, memory, GPU and every disk), a chip per service (a click narrows the logs to it), the drives, the devices on dadi and the helper tasks (a row of filter chips, then a row per task that opens a tall preview), beside a log card: a window of 1 h, 6 h or 24 h, a message filter, a menu of services, a chip per severity (errors and warnings with their count) and one line per record, newest first, which opens to its whole record; the log card goes under the cards when the page is narrower than 880 px. A failed read keeps the last answer under a stale banner, and an error toast's `?service=&q=&at=` pins its line. An agent's message to you never switches chats: unless its chat is open it toasts, and clicking the toast opens it. Unread counts are Hath's, so the desktop and the phone show the same badges: each row's count (a bolder name, a sage time and the count) comes from `GET /threads`, a reply raises it live unless it lands in the chat that is open in a visible window (notices are never counted), and a `thread_read` event from any device takes Hath's new count; marks only move forward, so an older summary or mark never undoes a newer one (`store/chat.ts`). The open chat is marked read through its newest message with `POST /agents/:id/read` when it opens, when a reply lands in it and when the window comes back into view (`chrome/chatSidebar/useMarkRead.ts`); a failed mark is logged as `thread_read_failed` and toasted. While the window is hidden or unfocused it also raises a native notification (`shared/lib/platform/notify.ts`, `tauri-plugin-notification`); a refused permission is logged as `notification_failed`. Memory/timeline call Yaad via `shared/api` (`yaad` client; paths live in `shared/api/yaad`). `/timeline` (`features/timeline/`) pages weeks and months with a shared `Glider` (`shared/components/Glider.tsx`): pages slide the way time moved, week columns cascade and month rows wash in diagonally, all-day and multi-day plans run as bars along the top of their days (the month lists each day's timed plans under them, with +N more opening its week), today breathes and carries a now marker, and a Next up pill counts down to the next plan. Memories that happened show under each day (dots on the month). Every view reads Yaad `POST /timeline` (`shared/api/timeline`): the planner is a filter over plans, not a store of its own. The Planner view (`features/timeline/planner/`, the page's default; the home tile opens `/timeline?view=week`) is one day drawn straight on the page with no panel around it: the weekday large with, on today, what is happening now and what is next beneath it, then the day's timed sessions (view `planner`) on an hour axis, each as tall as its time (commitments solid, the gym warm, routines quiet, cancelled ones struck through) with the time between them left open (named when it is 30 minutes or more); each session is one row of title and time range with its body under it, and on a wide window a column on the right stays in view with what is happening now (time left and a progress line) and what is next, the day's sessions with their lengths, and the first sessions of the next day (the query covers the shown day and the one after). Week reads the `planner` and `tile` views together, Month the `month` view (dues, all-day and multi-day sessions, one-off commitments), the Someday rail the `someday` view (ideas, and tasks that need a time), and the Home Timeline tile (`features/timeline/DayTile.tsx`) the `tile` view for today, as one row per session; the Month grid gives each week row a share of its height and folds what does not fit into +N more, so it never scrolls. A session opens a card (planner) or `NodePopover` (elsewhere: when, its state, series count and place, body, connections, and Open in Yaad → `/yaad?focus=<id>`) with the only write the app makes, Completed (`PUT /timeline/outcome`, done or taken back), and Message <owner>, which opens the chat of the agent that keeps it (Tell Dadi when no agent does); Tell Dadi in the header asks the router dock to open. Nothing on the timeline edits or deletes a plan: agents change it through memory ingest.  `/chaavi` (`pages/ChaaviPage.tsx`, `features/chaavi/`) is the vault over `http://chaavi.dadi/v1`: a pane that narrows the list (all items, the favorites, each kind of item and each folder, every row with its count of items in it; absent below 800 px of page), a searchable list of items (a mark, the name and one public line, a star, passkey and one-time code glyph) and the open item (`?item=` names the one to open on): every public field with a copy control and each secret masked until the eye shows it or the copy control copies it unseen, both after the computer's owner check (`shared/lib/platform/owner.ts`). A copied secret leaves the clipboard after 30 seconds if it is still there (`features/chaavi/clipboard.ts`); a login's one-time code is masked until revealed, then counts down in a ring and is fetched again as it turns over. Edit and New item open a sheet from the right edge (`ItemSheet.tsx`: a new item is a login, a secure note or a bank account; an existing one of any kind is edited through its own fields, a blank secret keeps its stored value and typing replaces it; custom fields, extra websites and the notes of a non-note item are kept as they are but not edited there), and a delete is asked in a dialog and moves the item to the vault's trash. A failure of a reveal, a copy or a save is a toast. Vaultwarden remains the encrypted store. Browser autofill uses the Bitwarden extension at `https://chaavi.dadi`. Desktop join fetches `GET /ca` from nas.dadi and installs the mesh CA so the extension trusts that HTTPS endpoint.

## Design tokens

Bone glass — field bloom, frosted veil panels, sage accent, in the light palette the design draws (the text-bearing inks are darkened to pass 4.5:1). Tokens in `src/styles/tokens.css` are the one source of values and match the Thaali design's generator exactly; `src/styles/primitives.css` holds the primitives' shared classes, under Tailwind's theme and utilities without its preflight, so the base is the design's own reset. Fonts under `src/assets/fonts/`.

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

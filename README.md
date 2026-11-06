# System Design Simulator

A browser-based notebook for distributed-systems concepts. Each tab is a
self-contained simulation — Request Flow, K8s Pod Lifecycle, and Raft Leader
Election — rendered with PixiJS and animated with GSAP.

## Requirements

- Node.js 24 LTS — see `.nvmrc` (`nvm install && nvm use`)
- npm

## Run locally

```bash
npm ci
npm run dev
```

`npm run dev` starts Vite on **http://127.0.0.1:8080/** and opens it in your
default browser. The host/port live in `vite.config.ts`; `strictPort` is on, so
if 8080 is already taken the command fails loudly instead of silently moving to
8081.

> **Keep this checkout out of iCloud Drive / Dropbox / OneDrive.**
> `node_modules` and `.git` must live on the local disk. When the sync provider
> evicts them ("dataless" files, reported as `blocks=0` by `stat`), Node reads
> block for minutes and Vite appears to start but never serves
> `/src/main.tsx`. If that happens: move the project to a non-synced folder,
> delete `node_modules`, and run `npm ci` again.

## Where the app starts

```
index.html                 # Vite entry; <div id="root"> + /src/main.tsx
└── src/main.tsx           # createRoot(root).render(<App />)
    └── src/App.tsx        # active tab state + lazy-loaded project pages
        ├── src/components/Navigation.tsx      # PROJECTS: the three tabs
        └── src/projects/<Project>/index.tsx   # canvas + controls for one tab
```

The rendering/simulation stack is split into three layers under `src/layers/`:

| Layer | Location | Responsibility |
| --- | --- | --- |
| 1 | `src/layers/layer1/` | PixiJS renderer (nodes, edges, particles) |
| 2 | `src/layers/layer2/` | Framework-free diagram model (nodes, edges, shards, replicas) |
| 3 | `src/layers/layer3/` | GSAP animation + scenario state machines |

See [`DESIGN_DOCUMENT.md`](./DESIGN_DOCUMENT.md) for the full architecture.

## Other commands

| Command | Description |
| --- | --- |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build on http://127.0.0.1:8080/ |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:ui` | Open the Vitest UI |

## Configuration

- `vite.config.ts` — dev/preview server, `@` → `src` alias, Vitest config
- `tailwind.config.js` — `notebook-*` color palette and fonts
- `postcss.config.js` — Tailwind + Autoprefixer

## For coding agents

See [`AGENTS.md`](./AGENTS.md) for commands, architecture notes, and the
definition of done. CI (`.github/workflows/ci.yml`) runs `npm run build` and
`npm test` on every push and pull request.


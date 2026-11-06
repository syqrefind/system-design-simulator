# AGENTS.md

Instructions for coding agents (DeepSeek Harness, Codex, Claude Code, …) working
in this repository. Keep this file current when commands or conventions change.

## Setup

- Node: the version in `.nvmrc` (`nvm install && nvm use`).
- Install with `npm ci` (the lockfile is committed). Use `npm install <pkg>` only
  when intentionally changing dependencies, and commit the updated
  `package-lock.json`.
- Keep the checkout on local disk — **not** inside iCloud Drive, Dropbox, or
  OneDrive. Cloud-evicted files make Vite hang on the first module transform.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on http://127.0.0.1:8080/ (opens a browser) |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:ui` | Vitest UI |
| `npm run build` | `tsc -b` type-check + Vite production build to `dist/` |
| `npm run preview` | Serve `dist/` on http://127.0.0.1:8080/ |

## Definition of done

Before considering a change complete:

1. `npm test` passes.
2. `npm run build` passes (this is also the TypeScript check).
3. `git status` shows only intended files — no `dist/`, `node_modules/`,
   `*.tsbuildinfo`, `.env*`, or raw prompt dumps.
4. Behavior changes come with a test in `src/__tests__/` (docs-only changes are
   exempt).

Never weaken or delete existing assertions to make a red test pass. Fix the
production code, or explain the intended behavior change in the commit message.

## Architecture

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`.
- `src/App.tsx` holds the active tab; tabs live in `src/components/Navigation.tsx`
  (`PROJECTS`) and are lazy-loaded from `src/projects/<Name>/index.tsx`.
- Three layers under `src/layers/`:
  - `layer1/` — PixiJS rendering only, no simulation logic;
  - `layer2/` — framework-free diagram model and primitives;
  - `layer3/` — GSAP animation and simulation state machines.
- Read `DESIGN_DOCUMENT.md` before changing layer boundaries.
- Styling: Tailwind utilities plus the `notebook-*` tokens in
  `tailwind.config.js`.

## Conventions

- TypeScript strict mode; avoid `any` and non-null assertions unless unavoidable.
- Keep `layer2/` and `layer3/` free of React and PixiJS imports.
- Small, focused modules; match existing formatting (2 spaces, single quotes).
- No new runtime dependencies without a clear reason — the stack is fixed:
  React 18 + PixiJS 8 + GSAP 3 + Tailwind 3.

## Git

- Small commits with conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`).
- `main` must stay green. Use a short-lived branch for multi-step work.
- Never `git push --force` and never rewrite `main` history.
- Push before switching devices; `git status` must be clean (or use a `wip/…`
  branch) so another machine can pick up exactly where you stopped.

## Security

- No secrets, tokens, or private keys in the repository or in fixtures.
- Local secrets go in `.env.local` (gitignored); document required variables in
  `.env.example`.

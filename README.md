# G2 Gym App

Workout trainer for Even Realities G2 smart glasses.  
Build training plans on phone, run workouts on glasses with gesture controls, and store workout history locally.

## Features

- Training plan editor (blocks, exercises, rounds, rest intervals)
- Markdown import/export for plans
- On-glasses workout flow with `Done`, `Skip`, and `Skip Rest` actions
- Rest timer with drift-corrected countdown
- Pause/resume support and active session recovery
- Workout logs with completion/abandon status
- Unit preference (`kg` / `lb`)

## Tech Stack

- TypeScript
- Vite
- Even Hub SDK (`@evenrealities/even_hub_sdk`)
- Even Hub CLI + Simulator
- Node test runner via `tsx --test`

## Project Structure

```text
src/
  app/         Controller + state machine
  adapters/    Even Hub bridge and localStorage persistence
  domain/      Workout engine, formatter, markdown parser/exporter, timer
  phone/       Phone web UI rendering and interactions
  services/    Wake lock service
  types/       Domain and adapter contracts
tests/         Unit tests for domain behavior
```

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- npm 10+
- Even App developer mode for running on real glasses

## Setup

```bash
npm install
```

## Development

Start local dev server:

```bash
npm run dev
```

Useful commands:

- `npm run sim` - start EvenHub simulator against `http://localhost:5173`
- `npm run qr` - show QR for opening the dev app in Even App
- `npm run test` - run tests
- `npm run typecheck` - TypeScript checks
- `npm run build` - typecheck + production build
- `npm run pack` - build and package `.ehpk` app bundle

## Build and Packaging

Generate production bundle:

```bash
npm run build
```

Package for Even Hub:

```bash
npm run pack
```

This produces an `.ehpk` package (ignored by git).

## Workout Markdown Format

Import/export uses this format:

```md
# Push Day A

## Chest [straight] x3
- rest: 60s
- block-rest: 90s
- exercise-rest: 0s

### Bench Press
- reps: 10
- load: 80kg
- notes: Pause at bottom
```

Supported reps:
- Fixed: `10`
- Range: `8-12`
- AMRAP: `AMRAP`
- Timed: `30s`

Supported load:
- Weight: `80kg`, `35lb`
- Bodyweight: `BW`
- RPE: `RPE 8`
- Percentage: `75%`

## Storage

Data is persisted in browser `localStorage` under:

- `g2gym.plans`
- `g2gym.session`
- `g2gym.logs`
- `g2gym.unit`

## Notes

- The app targets a TUI-like layout for G2 display containers.
- Wake lock is best-effort and silently degrades when unsupported.

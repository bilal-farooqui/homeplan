# Home plan walkthrough

Interactive 3D walk-through of a two-storey house (ground floor, first floor, street and exterior), built with three.js and Vite.

## Run
```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Use
- Computer: W A S D or arrow keys to move, drag to look, Shift to run, Q/E to turn.
- Phone: joystick to move, drag anywhere else to look.
- Buttons: Top view / Outside / Walk, and Night view / Day view.

## Data
- `src/data/floorplan.json` (first floor) and `src/data/floorplan-ground.json` (ground floor), in metres.
- `npm run validate -- floorplan-ground.json` checks furniture clearances and reachability.

## Assets
Photographic textures, HDRI skies and models are CC0 from polyhaven.com, in `public/assets` (see `public/assets/ATTRIBUTION.md`).
`tools/fetch_assets.py` re-downloads them; `tools/tune_textures.py` makes the floor tile white.

## Deploy
Static site: Vercel detects Vite (`npm run build`, output `dist`). `vercel.json` adds long-term caching for `/assets`.

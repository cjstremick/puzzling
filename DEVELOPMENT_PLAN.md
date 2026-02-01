# 🧩 Puzzling Jigsaw App - Development Plan & Task List

## Overview
A browser-based jigsaw puzzle app using TypeScript, HTML5 Canvas, and Pexels API. Features include image search, configurable difficulty, touch support, sound effects, and confetti celebrations.

**Tech Stack**: TypeScript, HTML5 Canvas 2D, Vite, canvas-confetti library.  
**Timeline**: ~8 weeks (part-time).  
**Target Platforms**: Desktop browsers, tablets (iPad/Android).

## Phase 1: Project Setup (Week 1)
- [x] Initialize Vite + TypeScript project (`npm create vite@latest puzzling -- --template vanilla-ts`)
- [x] Set up folder structure as outlined in README.md
- [x] Create basic HTML shell with canvas element
- [x] Configure TypeScript (strict mode, canvas types)
- [x] Test build pipeline and dev server (`npm run dev`)

## Phase 2: Image Search API (Week 2)
- [x] Obtain Pexels API key (free tier: 200 req/hr, 20k/month)
- [x] Implement `api/imageSearch.ts` (search endpoint, error handling, rate limiting)
- [x] Build `ui/searchPanel.ts` (keyword input, results grid, selection)
- [x] Add attribution data retrieval (photographer name, URLs)
- [x] Test API integration with mock searches

## Phase 3: Puzzle Generator (Week 3)
- [x] Implement `game/puzzleGenerator.ts` (grid layout, image slicing)
- [x] Create bezier curve algorithms for tab/blank generation
- [x] Define "die" patterns (5-10 predefined shapes, random rotation)
- [x] Build `game/piece.ts` (piece class: position, rotation, connections)
- [x] Ensure unique piece shapes and perfect edge matching

## Phase 4: Piece Interaction (Week 4)
- [x] Implement drag-and-drop in `utils/touch.ts` (Pointer Events API)
- [x] Add snapping logic (distance threshold, merge groups)
- [x] Implement double-tap flip/rotate (face-down → up, then 90° rotate)
- [x] Visual feedback (selected highlight, connection lines)
- [x] Test on desktop (mouse) and tablet (touch)
- [x] Fix face randomization (half pieces face-up on shuffle)
- [x] Fix rotated piece hit detection and positioning

## Phase 5: Game State & Logic (Week 5)
- [ ] Build `game/gameState.ts` (playing/completed states, timer, progress)
- [ ] Completion detection (all pieces connected and positioned)
- [ ] Difficulty presets (piece count ranges: 4-500)
- [ ] Edge-only mode toggle (hide interior pieces)
- [ ] Pre-flip option (randomly flip pieces face-down)

## Phase 6: UI Components (Week 6)
- [ ] Implement `ui/settingsPanel.ts` (difficulty, pre-flip, edge-only)
- [ ] Build `ui/referencePanel.ts` (peek button, pin toggle, drag/resize)
- [ ] Create `ui/statusbar.ts` (timer, progress, attribution watermark)
- [ ] Add start/completion screens with navigation
- [ ] Responsive CSS (desktop/tablet layouts)

## Phase 7: Audio & Polish (Week 7)
- [ ] Integrate `audio/soundManager.ts` (HTML5 Audio for all sounds)
- [ ] Add sound files to `public/sounds/` (free sources: Freesound, Pixabay)
- [ ] Implement `utils/confetti.ts` (canvas-confetti for celebrations)
- [ ] Smooth animations (transitions, hover states, piece movement)
- [ ] Touch optimizations (44px+ buttons, gesture support)

## Phase 8: Testing & Bug Fixes (Week 8)
- [ ] Desktop browser testing (Chrome, Firefox, Safari)
- [ ] Tablet testing (iPad, Android tablets - focus on touch gestures)
- [ ] Performance optimization (culling, caching, LOD for large puzzles)
- [ ] Edge case handling (small screens, network errors, rate limits)
- [ ] Final polish (accessibility, error messages, loading states)

## Dependencies
- `canvas-confetti`: ^1.9.4 (for celebrations)
- Vite: ^5.x (dev server/build)
- TypeScript: ^5.x (type safety)

## Key Algorithms
- **Piece Shapes**: Bezier curves for interlocking tabs/blanks; randomized "dies" for variety.
- **Snapping**: Distance-based edge matching (<20px threshold).
- **Completion**: Track connected pieces and positions.

## API Notes
- Pexels API: Free tier sufficient; cache results; show attribution prominently.
- Attribution: "Photos provided by Pexels" + photographer credits with links.

## Sound Assets (Add to public/sounds/)
- flip.mp3, rotate.mp3, snap.mp3, pickup.mp3, drop.mp3, celebration.mp3

## Questions for User
- Any specific sound effects you want (e.g., custom recordings)?
- Preferred confetti colors/themes?
- Should we add a "hint" feature (auto-sort edges)?
- Max piece count for tablets (e.g., 200 max on mobile)?
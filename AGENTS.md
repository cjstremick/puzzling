# AGENTS.md - Coding Guidelines for Puzzling Jigsaw App

This document provides coding standards, build commands, and development guidelines for the Puzzling Jigsaw browser-based puzzle game built with TypeScript, HTML5 Canvas, and Vite.

## Table of Contents
1. [Development Environment](#development-environment)
2. [Build and Run Commands](#build-and-run-commands)
3. [Testing](#testing)
4. [Completed Features](#completed-features)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Architecture Patterns](#architecture-patterns)
7. [File Organization](#file-organization)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)

## Development Environment

- **Node.js**: Version 18+ recommended
- **TypeScript**: Strict mode enabled
- **Vite**: For fast development and building
- **Browser**: Modern browsers with Canvas 2D support
- **IDE**: VS Code with TypeScript support recommended

## Build and Run Commands

### Development Server
```bash
npm run dev
```
Starts Vite development server with hot reload on http://localhost:5173

**Important:** Do not run `npm run dev` if the app is already running. Ask the user for testing results instead of starting a new server.

### Production Build
```bash
npm run build
```
Compiles TypeScript and bundles with Vite for production deployment

### Preview Production Build
```bash
npm run preview
```
Serves the built application locally for testing

### Type Checking
```bash
npx tsc --noEmit
```
Runs TypeScript compiler in check-only mode to validate types without emitting files

### Linting
```bash
npm run lint
```
Runs ESLint to check for code quality issues across TypeScript files

### Lint Fix
```bash
npm run lint:fix
```
Automatically fixes auto-fixable ESLint issues

## Testing

Currently, there is no test framework configured. To add testing:

1. Install Vitest: `npm install -D vitest @testing-library/jest-dom`
2. Add test script to package.json: `"test": "vitest"`
3. Create test files with `.test.ts` or `.spec.ts` extension
4. Run tests: `npm test`
5. Run single test: `npm test -- <test-file-name>`

Example test structure:
```
src/
  components/
    Button.test.ts
  utils/
    helpers.test.ts
```

## Completed Features

### Core Gameplay Features
- ✅ **Jigsaw Puzzle Engine**: Complete puzzle generation, rendering, and interaction system
- ✅ **Piece Manipulation**: Drag, rotate, flip, and snap puzzle pieces together
- ✅ **Image Search**: Pexels API integration for dynamic puzzle image selection
- ✅ **Difficulty Settings**: Easy (16 pieces), Medium (100 pieces), Hard (256 pieces)
- ✅ **Progress Tracking**: Real-time progress display and completion detection
- ✅ **Sound Effects**: Pickup, snap, drop, flip, rotate, and completion sounds
- ✅ **Celebration Effects**: Canvas confetti animation on puzzle completion
- ✅ **Touch & Mouse Support**: Unified pointer events for all input types

### Game State & Persistence
- ✅ **Game Persistence**: Automatic save/restore of puzzle state across page refreshes
- ✅ **Timer System**: Accurate game timing that persists across sessions
- ✅ **Settings Persistence**: Difficulty and other preferences saved locally
- ✅ **UI State Management**: Status bar and panels properly restore after refresh

### Bug Fixes & Improvements
- ✅ **Piece Selection Priority**: Smaller clusters can be selected behind larger ones
- ✅ **Progress Calculation**: Fixed to count largest cluster size instead of total connections
- ✅ **Confetti Layering**: Celebration effects appear above all UI elements
- ✅ **Timer Refresh**: Fixed negative timer display after page refresh
- ✅ **Status Bar Visibility**: Properly shows/hides during game state transitions
- ✅ **Canvas Responsiveness**: Adapts to different screen sizes and orientations

### Technical Features
- ✅ **Error Handling**: Comprehensive error handling with user-friendly messages
- ✅ **Input Validation**: Sanitization and validation for API queries
- ✅ **Rate Limiting**: Client-side rate limiting for API requests
- ✅ **Logging System**: Structured logging for debugging and monitoring
- ✅ **Type Safety**: Full TypeScript strict mode implementation
- ✅ **Performance Optimization**: Efficient canvas rendering and memory management

## Code Style Guidelines

### TypeScript Configuration
- Use strict TypeScript settings (`"strict": true` in tsconfig.json)
- Enable all strict checks including noImplicitAny, strictNullChecks, etc.
- Use explicit return types for functions (except React components)
- Prefer interfaces over types for object shapes
- Use union types for related variants

### Imports and Modules
```typescript
// Group imports: external libraries first, then internal modules
import confetti from 'canvas-confetti';
import type { PexelsPhoto } from '../api/imageSearch';
import { GameStateManager } from '../game/gameState';
import { SearchPanel } from './searchPanel';

// Use relative imports for internal modules
// Prefer named imports over default imports
// Import types with `import type` when only types are needed
```

### Naming Conventions
- **Classes**: PascalCase (e.g., `PuzzleBoard`, `GameStateManager`)
- **Interfaces**: PascalCase with 'I' prefix optional (e.g., `PuzzleConfig`, `GameSettings`)
- **Methods/Functions**: camelCase (e.g., `loadPuzzle()`, `handlePointerDown()`)
- **Variables/Properties**: camelCase (e.g., `selectedPiece`, `isDragging`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DIE_PATTERNS`)
- **Private members**: Prefix with underscore optional, but use `private` keyword
- **Files**: kebab-case for components (e.g., `search-panel.ts`), camelCase for utilities

### Formatting
- **Indentation**: 2 spaces (no tabs)
- **Line Length**: Max 100 characters
- **Semicolons**: Required
- **Quotes**: Single quotes for strings, double for JSX attributes
- **Trailing Commas**: Required in multiline objects/arrays
- **Braces**: Same line for control structures

```typescript
// Good
if (condition) {
  doSomething();
}

// Bad
if(condition)
{
  doSomething();
}
```

### Functions and Methods
- Use arrow functions for callbacks and short functions
- Prefer async/await over Promises for asynchronous code
- Use default parameters instead of conditional assignment
- Keep functions focused on single responsibility

```typescript
// Good
private async performSearch(): Promise<void> {
  const query = this.searchInput.value.trim();
  if (!query) return;

  try {
    const response = await imageSearchAPI.searchPhotos(query);
    this.displayResults(response.photos.slice(0, 4));
  } catch (error) {
    console.error('Search failed:', error);
    this.showError('Search failed. Please try again.');
  }
}
```

### Classes and Objects
- Use class syntax for components with state
- Prefer public/private/protected access modifiers
- Initialize properties in constructor or at declaration
- Use getter/setter for computed properties when needed

```typescript
export class PuzzleBoard {
  private canvas: HTMLCanvasElement;
  private pieces: PuzzlePiece[] = [];
  private selectedPiece: PuzzlePiece | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }
}
```

### DOM Manipulation
- Use modern DOM APIs (addEventListener, querySelector)
- Prefer CSS classes over inline styles for reusable styling
- Use Object.assign for setting multiple styles programmatically
- Avoid direct DOM manipulation in favor of state-driven updates

### Event Handling
- Use Pointer Events API for unified touch/mouse handling
- Attach event listeners in dedicated setup methods
- Clean up event listeners when components are destroyed
- Use event delegation when appropriate

## Architecture Patterns

### Component Architecture
- Separate UI components (`src/ui/`), game logic (`src/game/`), and utilities (`src/api/`, `src/utils/`)
- Use class-based components for stateful UI elements
- Implement event-driven communication between components
- Keep components focused and avoid tight coupling

### State Management
- Centralize game state in `GameStateManager`
- Use observer pattern for state change notifications
- Implement automatic persistence with `GamePersistence` utility
- Prefer immutable state updates
- Separate UI state from game state

### Canvas Rendering
- Use HTML5 Canvas 2D API for performance
- Implement double-buffering with offscreen canvases for complex scenes
- Batch rendering operations when possible
- Use requestAnimationFrame for smooth animations

## File Organization

```
src/
├── main.ts              # Application entry point
├── app.ts               # Main application controller
├── style.css            # Global styles
├── config/              # Application configuration
│   └── appConfig.ts     # API keys, constants, and app settings
├── game/                # Game logic and state management
│   ├── gameState.ts     # Central game state management
│   ├── piece.ts         # Individual puzzle piece class
│   ├── puzzleBoard.ts   # Canvas rendering and interaction
│   ├── puzzleGenerator.ts # Puzzle creation logic
│   └── types.ts         # TypeScript type definitions
├── ui/                  # User interface components
│   ├── searchPanel.ts   # Image search interface
│   ├── statusBar.ts     # Game status display
│   ├── settingsPanel.ts # Settings modal
│   └── referencePanel.ts # Reference image display
├── audio/               # Audio management
│   └── soundManager.ts  # Sound effects and audio playback
├── api/                 # External API integrations
│   └── imageSearch.ts   # Pexels API wrapper
└── utils/               # Utility functions and helpers
    ├── canvas.ts        # Canvas rendering helpers
    ├── touch.ts         # Touch/mouse event handling
    ├── gamePersistence.ts # Game state persistence (localStorage)
    ├── errorHandler.ts  # Error handling and logging utilities
    ├── logger.ts        # Structured logging system
    ├── validators.ts    # Input validation utilities
    └── confetti.ts      # Celebration effects
```

## Error Handling

### API Errors
- Wrap API calls in try/catch blocks
- Provide user-friendly error messages
- Implement fallback behavior when APIs fail
- Log errors for debugging

### User Input Validation
- Validate input before processing
- Provide immediate feedback for invalid input
- Use HTML5 form validation attributes
- Sanitize user input to prevent XSS

### Runtime Errors
- Use TypeScript strict mode to catch type errors at compile time
- Implement graceful degradation for unsupported features
- Provide fallback UI for error states
- Log errors with context for debugging

```typescript
try {
  await this.puzzleBoard.loadPuzzle(photo.src.large, config);
} catch (error) {
  console.error('Failed to load puzzle:', error);
  this.showError('Failed to load puzzle. Please try another image.');
}
```

## Performance Considerations

### Canvas Optimization
- Minimize canvas redraws by tracking dirty regions
- Use image caching for frequently used assets
- Implement object pooling for reusable elements
- Avoid expensive operations in render loops

### Memory Management
- Clean up event listeners when components are destroyed
- Clear canvas contexts when switching scenes
- Use WeakMap/WeakSet for caching when appropriate
- Monitor memory usage in development

### Bundle Size
- Use tree-shaking friendly imports
- Lazy-load non-critical components
- Minimize third-party dependencies
- Compress assets and use modern formats

### Accessibility
- Add ARIA labels for interactive elements
- Ensure keyboard navigation support
- Maintain sufficient color contrast
- Test with screen readers

## Git Workflow

- Use feature branches for new functionality
- Write descriptive commit messages
- Squash commits before merging
- Use pull requests for code review
- Keep commits atomic and focused

## Deployment

- Build for production with `npm run build`
- Deploy static files to any web server
- Currently hosted on GitHub Pages at `/puzzling/`
- No server-side dependencies required
- Ensure HTTPS for Pexels API access
- **Security Note**: Pexels API key is currently embedded in client-side code (acceptable for free tier, but consider proxy for production)

## Browser Support

- Modern browsers with ES2018+ support
- Canvas 2D API required
- Pointer Events API for touch support
- Fetch API for network requests

---

This document should be updated as the codebase evolves. Follow these guidelines to maintain code quality and consistency.
# Puzzling Jigsaw App

A browser-based jigsaw puzzle game built with TypeScript, HTML5 Canvas, and Vite. Create puzzles from images searched via the Pexels API and enjoy solving them with smooth drag-and-drop mechanics.

## Features

- **Image Search**: Search for images using the Pexels API to create custom puzzles
- **Interactive Gameplay**: Drag and drop puzzle pieces with touch/mouse support
- **Reference Panel**: View the original image for guidance
- **Settings Panel**: Customize puzzle difficulty and appearance
- **Responsive Design**: Works on desktop and mobile devices
- **Celebration Effects**: Confetti animation when puzzle is completed

## Live Demo

Play the game online: [https://cjstremick.github.io/puzzling/](https://cjstremick.github.io/puzzling/)

## Getting Started

### Prerequisites

- Node.js 18+
- Modern web browser with Canvas 2D support

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/cjstremick/puzzling.git
   cd puzzling
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## Technologies Used

- **TypeScript**: Type-safe JavaScript
- **HTML5 Canvas**: High-performance 2D graphics rendering
- **Vite**: Fast build tool and development server
- **Pexels API**: Image search integration
- **Canvas Confetti**: Celebration effects

## Architecture

The project follows a modular architecture with separate concerns:
- `src/game/`: Game logic and state management
- `src/ui/`: User interface components
- `src/api/`: External API integrations
- `src/utils/`: Utility functions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and not licensed for public use.
// src/config/appConfig.ts - Application configuration constants

export const APP_CONFIG = {
  API: {
    PEXELS_KEY: 'nNAnjKeUHclzAcVGVLDXnMULozJ0IeWWCXDXpGi3vUrjWNbM35rxRdYY',
    PEXELS_BASE_URL: 'https://api.pexels.com/v1',
    PEXELS_PER_PAGE: 20,
    PEXELS_MAX_PAGES: 100,
  },

  CANVAS: {
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600,
    STATUS_BAR_HEIGHT: 40,
  },

  SNAPPING: {
    DISTANCE: 30,
    DRAG_THRESHOLD: 5,
  },

  SOUND: {
    VOLUME: 0.3,
    ENABLED_BY_DEFAULT: false,
  },

  PUZZLE: {
    TAB_SIZE: 20,
    PIECE_OVERLAP: 10,
  },

  CELEBRATION: {
    DURATION: 3000,
    PARTICLE_COUNT: 50,
  },

  TIMING: {
    DOUBLE_TAP_DELAY: 300,
    LONG_PRESS_DELAY: 500,
    TIMER_UPDATE_INTERVAL: 1000,
  }
} as const;
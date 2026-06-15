# Task: Manga Reader v3 Full Structural Redesign

## Summary
Redesigned the manga reader component for LuffyTV with a complete structural overhaul inspired by Atsu.moe, Comix.to, and MangaFire.

## Changes Made

### 1. manga-reader.tsx — Complete Rewrite
- **Immersive Reader**: Black background, all controls auto-hide after 3 seconds of inactivity
- **Top Toolbar**: Floating glassmorphic bar with back button, manga/chapter title, mode switcher (Vertical/Single/Double), chapter sidebar toggle, settings toggle, fullscreen toggle
- **Progress Bar**: Thin red (#E63946) progress bar below toolbar
- **Three Reading Modes**:
  - Vertical Scroll: Pages stacked, scroll to read, page markers show on hover
  - Single Page: Horizontal snap scroll (CSS scroll-snap-type), one page at a time
  - Double Page: Two pages side by side, click zones for navigation
- **Settings Panel**: Slide-down from toolbar with image fit, reading direction (LTR/RTL), keyboard shortcuts
- **Chapter Sidebar**: Slide-in from right with glassmorphic overlay, sorted chapter list, current chapter highlighted
- **Bottom Navigation**: Floating glassmorphic bar with prev/next chapter buttons, page slider with current/total display
- **Page Markers**: Subtle page number overlay in vertical mode, shows on hover only
- **End-of-Chapter Navigation**: Divider, title, Prev/All Chapters/Next buttons
- **Keyboard Shortcuts**: Arrow keys navigate, C=chapters, S=settings, F=fullscreen, Esc=back
- **Mobile Optimized**: Safe area padding, touch to show/hide controls
- **Data Patterns Preserved**: Same fetch patterns, navigation via useAppStore, ChapterPage interface unchanged

### 2. globals.css — Complete mr- CSS Replacement
- Replaced all old mr- prefixed styles (v2) with new comprehensive v3 styles
- New glassmorphic toolbar and bottom nav styles with backdrop-filter blur
- Settings panel with slide-down animation
- Chapter sidebar with slide-in animation and backdrop overlay
- Custom range slider styling for page navigation
- Page marker hover effects
- Vertical container with custom thin scrollbar
- Snap scroll container for single page mode
- Double page display with click zones
- End-of-chapter navigation buttons
- Safe area inset padding for notched phones
- Loading and error screen styles

## Key Design Decisions
- Accent color: #E63946 (LuffyTV brand red) throughout
- Glassmorphic overlays: rgba(0,0,0,0.75) + blur(24px) for toolbar/nav
- Auto-hide timer: 3 seconds for controls, 5 seconds initially
- Page slider uses custom range input with red thumb and progress track
- Chapter sidebar uses backdrop overlay for closing
- Settings panel uses max-height transition for slide-down animation

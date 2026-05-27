# CBDev — CreativeBuilds.dev Portfolio

A single-page web portfolio that turns the entire browser window into an iPhone /
iPad running the (older) **iOS Liquid Glass** look. Hand-crafted React, Framer
Motion, and Tailwind — no build step required to view it.

> **Live entry point:** open `standalone.html` directly in any modern browser,
> or serve the folder over any static HTTP server.

## Highlights

- 📱 **Full iPhone shell** — status bar with live clock, Dynamic Island, signal /
  Wi-Fi / battery, home indicator, dock, squircle app icons.
- 🪟 **Liquid Glass throughout** — multi-layer `backdrop-filter` panels with
  inset highlights, refracted edges, and animated shimmer.
- 🎨 **Four cinematic themes** — Liquid Glass · Sunset · Midnight · Aqua
  (persisted via `localStorage`).
- ✨ **Icon-to-fullscreen morph** — Framer Motion shared `layoutId` for the iOS
  "tap-to-open" zoom; drag down or press `Esc` to close.
- 🎵 **Live radio mini-player** — streams `nightride.fm` synthwave channels
  with a global persistent audio element (keeps playing across app navigation).
- 🔐 **Mock auth popover** — sign-in / register glass sheet anchored to the
  status-bar avatar, with form validation and session persistence.
- 🖐️ **Touch-first ergonomics** — 36 × 36 px tap targets on mobile, pointer-
  capture sliders that never fight the parent swipe-to-dismiss gesture.
- ♿ **Accessibility-aware** — `prefers-reduced-motion` fallbacks, `aria-expanded`
  on every popover trigger, focus-visible outlines, semantic landmarks.

## Architecture

Everything ships from a **single self-contained HTML file** (`standalone.html`)
that boots React 18 + Framer Motion + Tailwind from CDNs and uses
`@babel/standalone` to transform JSX in the browser. Perfect for a portfolio
demo that needs zero deployment overhead.

```
standalone.html        ← The entire app. Open in a browser. That's it.
  ├─ <style>           ← Glass system, brand shimmer, scrollbar polish
  ├─ DeviceProvider    ← Global state: theme, open app, music, auth
  ├─ App definitions   ← AboutApp, ContactApp, ServicesApp, PortfolioApp,
  │                      MerchApp, BlogApp, SupportApp, LegalApp, MusicApp,
  │                      SettingsApp, ProjectApp×3
  └─ Device chrome     ← StatusBar, DynamicIsland, Wallpaper, HomeGrid,
                         Dock, AppView, Popover (Theme/Auth/MiniPlayer)
```

The legacy `src/` folder + Vite config are kept as a TypeScript scaffold for
a future production build, but the canonical experience is the standalone file.

## Run

**Easiest** — open `standalone.html` directly in Chrome / Edge / Safari /
Firefox. Everything loads from CDNs.

**Local server** (recommended for cleaner module loading):

```bash
# Python
python -m http.server 5173

# Node
npx serve -p 5173

# Vite (for the legacy src/ scaffold)
npm install && npm run dev
```

Then visit `http://localhost:5173/standalone.html`.

## Customising

- **Apps** — search for `const homeApps = [` or `const dockApps = [` in
  `standalone.html`. Each entry: `{ id, label, glyph, tile, view }`.
- **Themes** — search for `const themes = {`. Add a new key with `wallpaper`,
  `glass`, `orbs`, then push the id into `themeOrder`.
- **Content** — each app is a React function component (`AboutApp`,
  `ServicesApp`, etc.) directly in the file. Edit JSX in place.
- **Music stations** — search for `const stations = [` inside `MusicApp`.

## Tech

| Layer       | Choice                                                    |
| ----------- | --------------------------------------------------------- |
| UI runtime  | React 18 (CDN, ESM)                                       |
| Animation   | Framer Motion 11 (springs, `layoutId`, `AnimatePresence`) |
| Styling     | Tailwind CSS (CDN) + custom CSS for the glass system      |
| Audio       | Native `<audio>` + a global ref kept in context           |
| Persistence | `localStorage` (theme, eye, app order, auth)              |

## License

© CreativeBuilds.dev — all rights reserved. Code provided as a portfolio
showcase; reach out before reusing the design or content.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development
npm install
npm run dev        # Vite dev server at http://localhost:3000

# Build
npm run build      # Output to dist/
npm run preview    # Serve the dist/ build at http://localhost:3000

# Docker
docker build -t chroma-ui .
docker run --rm -p 3000:3000 chroma-ui
```

There is no test suite and no linter configured.

## Architecture

Chroma UI is a Photoshop-style single-page app for generating images with Chroma/Flux diffusion models. All API calls are made from the **browser** directly to a ComfyUI backend (default `http://127.0.0.1:8188`).

### State and data flow

All application state lives in `src/ChromaUI.jsx` and is passed down to child components via props. There is no global state library. The component tree is flat:

```
ChromaUI (all state)
├── MenuBar
├── Toolbar          (tool selection + generate button)
├── Canvas           (image display + inpaint brush canvas overlay)
├── PromptBar        (positive/negative prompt inputs)
├── ConfigPanel      (tabs: Config / Styles / History)
│   └── StylesPanel
└── StatusBar
```

### Generation modes

`ChromaUI.handleGenerate` dispatches to one of three workflows based on UI state:
- **txt2img** — default when no mask/image, uses `buildTxt2ImgWorkflow`
- **inpaint** — when `hasMask && currentImage`, uses `buildInpaintWorkflow`
- **upscale** — when `activeTool === "upscale" && currentImage`, uses `buildUpscaleWorkflow`

### API layer

`src/api/comfyApi.js` contains all ComfyUI communication:
- `queuePrompt` / `getHistory` / `pollForCompletion` — job lifecycle
- `uploadImage` — uploads canvas/mask PNGs to ComfyUI `/upload/image`
- `buildTxt2ImgWorkflow` / `buildInpaintWorkflow` / `buildUpscaleWorkflow` — return hardcoded ComfyUI workflow JSON graphs

**ComfyUI node IDs are hardcoded** in the workflow builders and in `ChromaUI.jsx`. Key output nodes:
- Node `"7"` — stitched inpaint result
- Node `"740"` — txt2img / upscale output
- Node `"38"` — inpaint context preview (skip this when looking for the final image)

### Styling

All styles are inline React objects — there are no CSS files. Shared style constants are in `src/styles.js`:
- `COLORS` — the full color palette (dark theme, accent `#a78bfa`)
- `inputStyle`, `selectStyle`, `sliderStyle`, `labelStyle`, etc. — reused across components

### Constants and defaults

`src/constants.js` holds canvas size presets, the default ComfyUI URL, and `DEFAULTS` for all generation parameters (steps, cfg, model filenames, brush size, etc.).

### Style presets

`src/data/styles.json` contains a list of style objects with `{ name, prompt, preview? }`. `StylesPanel` renders these and `ChromaUI` appends the selected style's prompt to the positive prompt at generation time.

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
├── MenuBar          (connection status display)
├── Toolbar          (tool selection + generate button)
├── Canvas           (image display + inpaint brush canvas overlay)
├── PromptBar        (positive/negative prompt inputs)
├── ConfigPanel      (tabs: Config / Styles / History)
│   └── StylesPanel
└── StatusBar        (status message, canvas size, active tool, zoom)
```

### Generation modes

`ChromaUI.handleGenerate` dispatches to one of three workflows based on UI state, checked in this order:

- **upscale** — `activeTool === "upscale" && currentImage`, uses `buildUpscaleWorkflow`
- **inpaint** — `activeTool === "inpaint" && hasMask && currentImage`, uses `buildInpaintWorkflow`
- **txt2img** — default fallback, uses `buildTxt2ImgWorkflow`

Switching away from the inpaint tool falls back to txt2img while retaining the mask.

### Canvas sizing

Two separate size states are maintained:

- `canvasSize` — derived from the loaded image; synced automatically via `useEffect` when `currentImage` changes. Used as the output resolution for inpaint.
- `genSize` — user-controlled dropdown. Only used as the output resolution for txt2img. Decoupled from `canvasSize` so upscaling doesn't force the next txt2img to run at the upscaled resolution.

### Inpaint context preview

When the user lifts the brush after painting a mask, `onMaskStrokeDone` fires immediately (no debounce). This triggers a partial inpaint workflow (`contextOnly: true`) that runs only up to the `InpaintCropImproved` node, retrieves the context preview from node `"38"`, displays it in the History tab, and switches the active tab to History.

### API layer

`src/api/comfyApi.js` contains all ComfyUI communication:
- `queuePrompt` / `getHistory` / `pollForCompletion` — job lifecycle
- `uploadImage` — uploads canvas/mask PNGs to ComfyUI `/upload/image`
- `buildTxt2ImgWorkflow` / `buildInpaintWorkflow` / `buildUpscaleWorkflow` — return hardcoded ComfyUI workflow JSON graphs
- `fetchLoras` / `fetchModels` — introspect available models via `/object_info`
- `interruptExecution` — POST `/interrupt` to cancel a running job

**ComfyUI node IDs are hardcoded** in the workflow builders and in `ChromaUI.jsx`. Key output nodes:
- Node `"7"` — stitched inpaint result (final output)
- Node `"740"` — txt2img / upscale output
- Node `"38"` — inpaint context preview (always skipped when looking for final image)

All three workflows share node IDs for the model loaders (UNET `731`, CLIP `733`, VAE `710`) so ComfyUI can cache model weights across generations.

### History and currentImage

- **txt2img / upscale** results update `currentImage`, which syncs `canvasSize`.
- **Inpaint** results are added to history but do **not** update `currentImage` — the user picks from the History tab.
- `generatedImages` stores `{ url, filename, prompt, timestamp, seed, type }` objects.

### Cancellation

Uses an `AbortController` to stop polling and calls `api.interruptExecution` (POST `/interrupt`) to halt ComfyUI mid-generation. Both user cancel and external ComfyUI interruption are handled.

### Keyboard shortcuts

Tool shortcuts (blocked when focus is in an input/textarea):

| Key | Tool |
|-----|------|
| V | Pointer |
| M | Move |
| I | Inpaint |
| U | Upscale |

Canvas shortcuts:
- `+` / `=` — zoom in (max 5×)
- `-` — zoom out (min 0.1×)
- `0` — reset zoom and pan
- `Ctrl+Enter` — generate (works inside prompt textareas)
- `Alt+drag` — erase mask while in inpaint tool

### Styling

All styles are inline React objects — there are no CSS files. Shared style constants are in `src/styles.js`:
- `COLORS` — full color palette (dark theme, accent `#a78bfa` purple)
- `inputStyle`, `selectStyle`, `sliderStyle`, `labelStyle`, `valStyle`, etc. — reused across components

### Constants and defaults

`src/constants.js` holds:
- `COMFYUI_DEFAULT` — `http://127.0.0.1:8188`
- `CANVAS_SIZES` — 9 presets (square, portrait, landscape at various resolutions)
- `DEFAULT_CANVAS_INDEX` — `7` (1024×1536 portrait)
- `DEFAULTS` — all generation parameter defaults (steps, cfg, shift, model filenames, brush size, inpaint/upscale settings, etc.)

### Style presets

`src/data/styles.json` contains a list of style objects with `{ name, prompt, preview? }`. `StylesPanel` renders these and `ChromaUI` appends the selected style's prompt to the positive prompt at generation time.

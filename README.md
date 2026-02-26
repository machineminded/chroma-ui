# Chroma UI

A Photoshop-style interface for Chroma/Flux diffusion models, powered by a ComfyUI backend.

## Docker

```bash
# Build
docker build -t chroma-ui .

# Run
docker run -p 3000:3000 chroma-ui
```

Then open http://localhost:3000

## Local Dev (no Docker)

```bash
npm install
npm run dev
```

## ComfyUI Connection

By default, the UI connects to ComfyUI at `http://127.0.0.1:8188`. You can change this in the Config panel on the right side.

**Important**: If you're running ComfyUI in a separate Docker container, use `http://host.docker.internal:8188` instead of `127.0.0.1` so the browser can reach ComfyUI on your host machine. Note that the API calls are made from the **browser**, not from the container, so `127.0.0.1` will usually work fine as long as ComfyUI is running on the same machine where you open the browser.

Make sure ComfyUI has `--listen 0.0.0.0` and `--enable-cors-header` flags enabled.  `--cache-lru 20` will help with speed when switching between txt2img, inpainting, and upscaling.

```
python main.py --listen --use-sage-attention --cache-lru 20 --enable-cors-header
```

# Todo

Use https://github.com/ltdrdata/ComfyUI-Inspire-Pack for cachine
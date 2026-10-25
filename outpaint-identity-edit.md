# Plan: Krea2 outpaint + identity edit

Status: **planning only, nothing built.** Branch: `feature/krea2-outpaint`.

Goal: outpaint an image where the subject's head is out of frame, then run an
identity edit with a face reference image so the generated head matches a real
person. Constraint: **no new custom nodes.** Use existing node packs; the app
only builds workflow JSON.

---

## Background research (2026-10-17)

### Outpaint / inpaint options for Krea 2

| Option | Base | Inpaint | Outpaint | Notes |
|---|---|---|---|---|
| [krea2-anypaint](https://github.com/alexw5702-afk/krea2-anypaint) nodes + [yijunwang2/krea2-anypaint](https://huggingface.co/yijunwang2/krea2-anypaint) LoRA | Turbo int8 convrot (our model) | ✅ any mask | ✅ padding on each side | **Chosen.** 8,406 LoRA downloads (most of its kind) |
| [ComfyUI-Rebels-Krea2-Outpaint](https://github.com/RealRebelAI/ComfyUI-Rebels-Krea2-Outpaint) | Turbo | ❌ | ✅ one direction per pass | Rectangular only |
| [Cierpliwy/krea2-inpaint-edit](https://huggingface.co/Cierpliwy/krea2-inpaint-edit) | Raw only | ✅ | ✅ black padding | Doesn't match our Turbo setup |
| `InpaintCropImproved` `extend_for_outpainting` | any | already used | ✅ stretches edges | No install, but plain Turbo isn't trained to fill |

AnyPaint details:
- Nodes: `Krea2AnyPaintPrepare` (source, optional mask, padding top/left/bottom/right,
  `reference_max_edge` 384, `boundary_redraw_px` 32), `Krea2AnyPaintEncode`
  (clip, vae, prompt, VLM reference on), `Krea2AnyPaintModelPatch` (after the
  LoRA, kv_cache on).
- Example workflow: `krea2_anypaint_workflow.json` in the repo root
  ([raw](https://raw.githubusercontent.com/alexw5702-afk/krea2-anypaint/main/krea2_anypaint_workflow.json)).
- Settings: euler / simple, 8 steps, CFG 1, denoise 1, LoRA strength 1.
- White mask or padded pixels are generated; black pixels are kept. Padding of
  zero gives plain inpaint.
- Example uses `qwen_image_vae.safetensors`. Our Krea2 default is
  `wan_2.1_vae.safetensors`, so check whether they're interchangeable.
- Risks: repo written in one day (2026-08-03), never updated, 44 stars, 3
  unanswered issues (one reports the masked area "completely removed", one
  reports object removal always generating a new object). MIT, small, so it
  can be forked if needed. Pin to the current commit.

### Face / identity reference options

AnyPaint's only reference is the source image itself. It has no input for an
extra face image, so it will invent a head. Identity needs a second pass:

- [conradlocke/krea2-identity-edit](https://huggingface.co/conradlocke/krea2-identity-edit) v2
  (`comfyui-krea2edit` ≥ 2.0.0): Turbo 8 steps CFG 1, `ref_boost` 1–2,
  `grounding_px` 768; scene ref `aligned`, person ref `beside`. 139k
  downloads/month. **Non-commercial** unless licensed. Known issues: outpainting
  unreliable, head swaps become whole-person swaps, clothing carries over,
  two LoRAs at strength 1.0 give noise (use ~0.6 each).
- [ComfyUI-Krea2-Reference](https://github.com/KonokoAz/ComfyUI-Krea2-Reference):
  up to 4 reference images as Qwen3-VL vision tokens (`character1` etc.), works
  on Turbo.
- Not chosen: replacing AnyPaint's encoder with the reference encoder in one
  pass (it would likely break known-pixel preservation), or pasting a face crop
  into the padded area as a guide (AnyPaint redraws masked areas fully).

The user has their own identity edit workflow and LoRA to try for pass 2.

---

## Approach: two graphs, run back to back by the app

The app queues two separate ComfyUI prompts in sequence:

1. **Outpaint (AnyPaint):** source image + padding on each side (+ optional
   brush mask) → extended image. Saved and added to History.
2. **Identity edit:** outpainted image + face reference → final image. Saved
   and added to History.

Why not one combined graph:
- Each builder copies a workflow already proven in ComfyUI, so a failure points
  to one pass.
- The outpaint result is visible before the face pass, and the identity step
  can be rerun alone with a new seed.
- The identity step also works on any image, not only outpaint results.

Cost: the same Krea2 UNET stays loaded; only LoRAs change between passes. Pass 2
can load pass 1's output directly with `LoadImage` using `"<file> [output]"`, so
the browser doesn't download and re-upload the image.

---

## Steps

### Step 0: prove it by hand in ComfyUI (user, no code)
1. Run AnyPaint on a photo with the head cut off, adding top padding (256–512).
2. Load the result into the identity edit workflow with the face reference.
3. Record what works: padding, VAE (`qwen_image_vae` vs `wan_2.1_vae`), steps
   and strengths for both passes, and the identity prompt wording.
4. Export both workflows in **API format** (Workflow → Export (API)) and save
   them in the repo root next to `krea inpainting.json`.

If this doesn't produce a good head, stop here before writing code.

### Step 1: workflow builders (`src/workflows/krea2.js`)
- `buildOutpaint({ imageName, maskName?, padTop, padRight, padBottom, padLeft, prompt, seed, … })`:
  UNETLoader → user LoRA chain → AnyPaint LoRA → `Krea2AnyPaintModelPatch` →
  KSampler, with `Prepare` → `Encode` supplying latent + conditioning. euler /
  simple, 8 steps, CFG 1, denoise 1. New output node ID.
- `buildIdentityEdit({ sceneImageName, referenceImageName, prompt, seed, … })`:
  copies the user's identity workflow node for node.
- Register both in `outputNodes`; add capability flags (`supportsOutpaint`,
  `supportsIdentityEdit`) so Chroma doesn't show these options.

### Step 2: running the passes (`src/ChromaUI.jsx`)
- Add an `outpaint` branch to `runGeneration`, next to inpaint.
- On success, if a face reference is set, queue the identity pass on pass 1's
  output.
- Both results go to History; the final one becomes the current image.
- Cancel stops whichever pass is running (existing abort plumbing).

### Step 3: UI
- **Outpaint tool** in the Toolbar, with padding inputs for each side in
  ConfigPanel, rounded to multiples of 32. Optional dashed overlay on the canvas
  showing the area being added.
- **Face reference picker**, following the img2img "load file" pattern
  (thumbnail + clear). Setting a reference turns on pass 2.
- **Separate identity prompt.** AnyPaint wants a description of the whole
  image; the identity pass wants something like "the person from the
  reference". Default to a fixed template.

---

## Risks
- Head swaps turning into whole-person swaps, clothing from the reference
  carrying over. If the identity workflow takes a mask, limit it to the head.
- AnyPaint is unmaintained; pin the commit, fork if it breaks.
- LoRA stacking: user LoRA slots + AnyPaint or identity LoRA may clash (noise
  reported with two LoRAs at strength 1.0).

## Progress

**2026-10-18: combined ComfyUI workflow built for hand testing** (not in the app):
- `krea2 outpaint identity edit.json`: both passes in one graph, made by copying
  every node verbatim from the AnyPaint example and the user's identity
  workflow, and changing only the wiring:
  - CLIP (`qwen3vl_4b_fp8_scaled`) and VAE (`wan_2.1_vae`) loaders shared by both passes.
  - Two UNET loaders kept: pass 1 `Krea2_Turbo_convrot_int8mixed-extra`
    (base Turbo, which AnyPaint was trained on), pass 2
    `kromafineTurboBF16FP8_v10_int8` (from the user's identity workflow).
  - The AnyPaint VAEDecode output replaces identity LoadImage 72 as image 1
    (scene), feeding VAEEncode 73, both GroundedEncodes, and ModelPatch `source_image`.
  - The identity output size (EmptySD3LatentImage 82) comes from Prepare
    `canvas_width/height` instead of ResolutionSelector 83.
  - Person-reference VAEEncode 92 un-bypassed (two-image mode); LoadImage 90 =
    face reference.
  - Prepare padding preset: top 384. Both passes save (`krea2_outpaint_pass1_*`,
    `krea2_outpaint_identity_*`).
- `krea2 identity edit.json`: the user's original identity workflow, kept as
  reference. Node pack: lbouaraba/comfyui-krea2edit (`Krea2EditModelPatch`,
  `Krea2EditGroundedEncode`), LoRA `krea2_identity_edit_v2.safetensors`, 10 steps.

## Open questions
1. ~~Path to the user's identity edit workflow JSON.~~ Done, see Progress.
2. ~~How AnyPaint did in testing.~~ **2026-10-18: user tested AnyPaint in
   ComfyUI and it "works great"** using `wan_2.1_vae.safetensors`, so the
   app's existing Krea2 VAE default works and the builder doesn't need
   `qwen_image_vae`.
3. Should the user LoRA slots apply to the outpaint pass, the identity pass,
   both, or neither? Leaning toward outpaint only, so the identity pass stays as
   tuned.

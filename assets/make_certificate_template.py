#!/usr/bin/env python3
"""
Build the STATIC certificate template from the generated master artwork.

Original art is produced with an image model (see assets/gen/bg_raw.png) and
contains NO text at all, so nothing can garble. This script only does
deterministic geometry work:

  1. crop the master to US-Letter-Landscape ratio (792 x 612 pt)
  2. resize to a print-resolution raster
  3. cut the wax seal out of its white background -> transparent PNG
  4. emit base64 JS modules so the serverless runtime never touches the fs

ALL text (headings, name, verse, labels, signature rules) is drawn at runtime
by src/lib/certificate.js with pdf-lib + the OFL fonts in assets/fonts, which
keeps type crisp and lets the dynamic fields line up exactly.

Usage:  python3 assets/make_certificate_template.py
"""

import base64
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, "assets", "gen")
OUT_TEMPLATE_JPG = os.path.join(ROOT, "assets", "certificate-template.jpg")
OUT_SEAL_PNG = os.path.join(ROOT, "assets", "certificate-seal.png")
OUT_PREVIEW = os.path.join(ROOT, "assets", "certificate-preview.png")
OUT_TEMPLATE_JS = os.path.join(ROOT, "src", "lib", "certificateTemplate.js")
OUT_SEAL_JS = os.path.join(ROOT, "src", "lib", "certificateSeal.js")

# US Letter landscape at 300 dpi
PAGE_W_PT, PAGE_H_PT = 792, 612
RATIO = PAGE_W_PT / PAGE_H_PT          # 1.2941...
W, H = 3300, int(round(3300 / RATIO))  # 3300 x 2550


def _pad_to(img, w, h):
    """Grow the canvas to (w,h) by replicating the outermost pixel row/column.

    The master's outer band is a flat navy frame, so edge replication is
    invisible and preserves the framing artwork instead of cropping it off.
    """
    out = Image.new("RGB", (w, h), img.getpixel((1, 1)))
    out.paste(img, ((w - img.size[0]) // 2, (h - img.size[1]) // 2))

    # smear the source edges outward to fill the new margin
    if w > img.size[0]:
        left = (w - img.size[0]) // 2
        out.paste(img.crop((0, 0, 1, img.size[1])).resize((left, img.size[1])), (0, 0))
        right = w - img.size[0] - left
        out.paste(img.crop((img.size[0] - 1, 0, img.size[0], img.size[1])).resize((right, img.size[1])),
                  (left + img.size[0], 0))
    if h > img.size[1]:
        top = (h - img.size[1]) // 2
        out.paste(out.crop((0, 0, w, 1)).resize((w, top)), (0, 0))
        bot = h - img.size[1] - top
        out.paste(out.crop((0, h - top - 1, w, h - top)).resize((w, bot)), (0, top + img.size[1]))
    return out


# Target parchment panel as a fraction of the page.  The generated master has a
# beautiful panel but its torn edges wander (usable width 0.44..0.77), which
# makes centred type unpredictable.  We re-lay a clean, gently-rounded panel
# using the artwork's OWN parchment texture so it still reads as painted, then
# feather it into the landscape.
PANEL_L, PANEL_R = 0.213, 0.787        # 0.574 wide
PANEL_T, PANEL_B = 0.047, 0.885
PANEL_FEATHER = 46                     # px, soft edge
PANEL_RADIUS = 150                     # px, corner roundness


def normalize_panel(img):
    """Re-lay a clean rectangular parchment panel from the art's own texture."""
    from PIL import ImageDraw

    w, h = img.size
    px0, px1 = int(w * PANEL_L), int(w * PANEL_R)
    py0, py1 = int(h * PANEL_T), int(h * PANEL_B)
    pw, ph = px1 - px0, py1 - py0

    # --- sample pure parchment from a clean area of the existing panel
    sx0, sx1 = int(w * 0.320), int(w * 0.680)
    sy0, sy1 = int(h * 0.090), int(h * 0.340)
    patch = img.crop((sx0, sy0, sx1, sy1))

    # cover the target rect by tiling the patch (it is near-uniform parchment)
    tex = Image.new("RGB", (pw, ph))
    tw, th = patch.size
    for y in range(0, ph, th):
        for x in range(0, pw, tw):
            tex.paste(patch, (x, y))
    tex = tex.filter(ImageFilter.GaussianBlur(2.2))
    # knock it back a touch so the original art's grain/ageing still reads
    tex = Image.blend(tex, Image.new("RGB", (pw, ph), (247, 240, 224)), 0.16)

    # --- feathered, gently rounded mask
    m = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, pw - 1, ph - 1], radius=PANEL_RADIUS, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(PANEL_FEATHER))
    # push it to near-solid in the interior so text always has a flat ground
    m = m.point(lambda v: min(255, int(v * 1.35)))

    img.paste(tex, (px0, py0), m)

    # --- soft inner vignette so the panel feels lit from above, like the art
    ov = Image.new("L", (pw, ph), 0)
    od = ImageDraw.Draw(ov)
    band = int(ph * 0.30)
    for i in range(band):
        a = int(46 * (1 - i / band) ** 1.7)
        od.rectangle([i, i, pw - 1 - i, ph - 1 - i], outline=a, width=1)
    ov = ov.filter(ImageFilter.GaussianBlur(18))
    ov = ImageChops.multiply(ov, m)
    shade = Image.new("RGB", (pw, ph), (196, 178, 146))
    img.paste(shade, (px0, py0), ov)

    return img


def build_template():
    src = Image.open(os.path.join(GEN, "bg_raw.png")).convert("RGB")
    sw, sh = src.size
    print("master:", sw, "x", sh, "ratio %.4f" % (sw / sh))

    # Fit to the target ratio WITHOUT clipping the gold frame.  Small excess is
    # centre-cropped; a larger mismatch is made up by replicating the outer
    # border pixels (the frame band is flat navy, so this is invisible).
    need_w = int(round(sh * RATIO))
    need_h = int(round(sw / RATIO))

    if sw >= need_w:
        trim = (sw - need_w) // 2
        if trim > sw * 0.022:                       # too much to crop safely
            src = _pad_to(src, sw, need_h)          # add height instead
        else:
            src = src.crop((trim, 0, trim + need_w, sh))
    else:
        trim = (sh - need_h) // 2
        if trim > sh * 0.022:
            src = _pad_to(src, need_w, sh)
        else:
            src = src.crop((0, trim, sw, trim + need_h))
    print("fitted:", src.size, "ratio %.4f" % (src.size[0] / src.size[1]))

    img = src.resize((W, H), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=3))
    img = normalize_panel(img)
    return img


def build_seal():
    """Dark green wax seal on white -> RGBA with alpha + trimmed to content."""
    src = Image.open(os.path.join(GEN, "seal_raw.png")).convert("RGB")
    a = np.asarray(src).astype(np.float32)

    # White background -> alpha.  Distance from pure white, with a soft knee so
    # the seal's own bright gold highlights are not punched out.
    dist = 255.0 - a.min(axis=2)
    alpha = np.clip((dist - 8.0) / 26.0, 0.0, 1.0)
    # keep the interior fully opaque (flood the outside-in gaps shut)
    solid = np.clip((dist - 30.0) / 40.0, 0.0, 1.0)
    alpha = np.maximum(alpha, solid)

    out = np.dstack([a, alpha * 255.0]).astype(np.uint8)
    seal = Image.fromarray(out, "RGBA")

    # trim to content, then square it up with a small transparent margin
    bbox = seal.split()[3].getbbox()
    if bbox:
        seal = seal.crop(bbox)
    s = max(seal.size)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.paste(seal, ((s - seal.size[0]) // 2, (s - seal.size[1]) // 2))
    # 560px is ample for the ~95pt seal drawn on the PDF; keeps the base64 small.
    seal = canvas.resize((560, 560), Image.LANCZOS)
    return seal


def write_js(path, export_name, mime, raw_bytes, comment):
    b64 = base64.b64encode(raw_bytes).decode("ascii")
    body = (
        "// AUTO-GENERATED by assets/make_certificate_template.py — do not edit.\n"
        f"// {comment}\n"
        f"// {mime}, {len(raw_bytes) // 1024} KB raw ({len(b64) // 1024} KB base64)\n\n"
        f"export const {export_name} =\n  '{b64}'\n\n"
        f"export const {export_name}Mime = '{mime}'\n"
    )
    with open(path, "w") as f:
        f.write(body)
    print("wrote", os.path.relpath(path, ROOT), len(b64) // 1024, "KB base64")


def main():
    print("template...")
    img = build_template()
    img.save(OUT_TEMPLATE_JPG, "JPEG", quality=86, optimize=True, progressive=True)
    print("wrote", os.path.relpath(OUT_TEMPLATE_JPG, ROOT),
          os.path.getsize(OUT_TEMPLATE_JPG) // 1024, "KB")

    print("seal...")
    seal = build_seal()
    seal.save(OUT_SEAL_PNG, "PNG", optimize=True)
    print("wrote", os.path.relpath(OUT_SEAL_PNG, ROOT),
          os.path.getsize(OUT_SEAL_PNG) // 1024, "KB")

    prev = img.copy().resize((1200, int(1200 * H / W)), Image.LANCZOS)
    prev.save(OUT_PREVIEW)
    print("wrote preview")

    with open(OUT_TEMPLATE_JPG, "rb") as f:
        write_js(OUT_TEMPLATE_JS, "CERTIFICATE_TEMPLATE", "image/jpeg", f.read(),
                 "Ornate landscape certificate background (no text).")
    with open(OUT_SEAL_PNG, "rb") as f:
        write_js(OUT_SEAL_JS, "CERTIFICATE_SEAL", "image/png", f.read(),
                 "Transparent wax seal, drawn by pdf-lib at the signature line.")

    print("\n--- page (%dx%d px @300dpi -> %.3f x %.3f in) ---" % (
        W, H, W / 300, H / 300))
    print("  pdf page points: %.0f x %.0f" % (PAGE_W_PT, PAGE_H_PT))


if __name__ == "__main__":
    main()

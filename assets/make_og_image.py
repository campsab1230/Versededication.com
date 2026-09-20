#!/usr/bin/env python3
"""
Builds the social share card (Open Graph / Twitter) for Verse Dedication.

Design: editorial two-column layout — brand type on the left, the
text-free certificate artwork in a gold frame on the right, so the card
shows the actual product without fabricating a customer name.

Output: public/og-image.png  (1200x630, the canonical OG size)

Run from the repo root:
    python3 assets/make_og_image.py
"""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------- canvas
W, H = 1200, 630          # canonical OG / summary_large_image size
SS = 2                    # supersample factor for crisp type + hairlines

# ---------------------------------------------------------------- palette
# Mirrors the custom properties in src/styles/globals.css
NAVY = (18, 25, 42)
NAVY_2 = (28, 37, 64)
CREAM = (244, 238, 224)
INK_SOFT = (199, 187, 162)
GOLD = (168, 130, 61)
GOLD_LIGHT = (201, 169, 104)
GOLD_DEEP = (122, 95, 44)

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
TEMPLATE = os.path.join(os.path.dirname(__file__), "certificate-template.jpg")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "og-image.png")

# ---------------------------------------------------------------- copy
KICKER = "A CERTIFICATE OF DEDICATION"
TITLE_LINES = ["Verse", "Dedication"]
TAGLINE = "A word for today."
CHARITY_LINES = [
    "10% of every purchase helps translate",
    "Scripture for people who don't have it yet.",
]
DOMAIN = "versededication.com"


# ---------------------------------------------------------------- helpers
def s(v):
    """Scale a design unit to the supersampled canvas."""
    return int(round(v * SS))


def load(path, size):
    return ImageFont.truetype(path, s(size))


def instanced_cinzel_bold():
    """
    Cinzel ships as a variable font ([wght]); the static Bold instance is
    generated here so PIL can use it directly. Cached to assets/fonts/build/
    exactly like the certificate font pipeline does.
    """
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    cache_dir = os.path.join(FONT_DIR, "build")
    os.makedirs(cache_dir, exist_ok=True)
    out = os.path.join(cache_dir, "Cinzel-Bold-static.ttf")
    if not os.path.exists(out):
        f = TTFont(os.path.join(FONT_DIR, "Cinzel-var.ttf"))
        inst = instantiateVariableFont(f, {"wght": 700}, inplace=True)
        inst.save(out)
    return out


def tracked_width(draw, text, font, tracking):
    """Pixel width of `text` once letterspacing is applied."""
    tracking = s(tracking)
    total = 0
    for ch in text:
        total += draw.textlength(ch, font=font) + tracking
    return total - tracking if text else 0


def draw_tracked(draw, xy, text, font, fill, tracking, anchor="ls"):
    """Draw letterspaced text. anchor: 'ls' = left/baseline."""
    tracking = s(tracking)
    x, y = xy
    if anchor.startswith("m"):
        x -= tracked_width(draw, text, font, tracking / SS) / 2
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font) + tracking


def radial_glow(size, center, radius, color, max_alpha):
    """
    Cheap alpha-only radial glow used behind the certificate frame.
    Built with concentric ellipses (PIL has no radial gradient primitive).
    """
    gw, gh = size
    layer = Image.new("L", (gw, gh), 0)
    d = ImageDraw.Draw(layer)
    steps = 60
    for i in range(steps, 0, -1):
        r = radius * (i / steps)
        a = int(max_alpha * (1 - i / steps) ** 1.6)
        d.ellipse(
            [center[0] - r, center[1] - r * 0.82,
             center[0] + r, center[1] + r * 0.82],
            fill=a,
        )
    layer = layer.filter(ImageFilter.GaussianBlur(s(22)))
    glow = Image.new("RGBA", (gw, gh), color + (0,))
    glow.putalpha(layer)
    return glow


def rule_with_diamond(draw, cx, y, half, color, diamond=5):
    """A centred hairline with a small diamond at each end and the centre."""
    y = s(y)
    draw.line([(s(cx - half), y), (s(cx + half), y)], fill=color, width=max(1, s(1)))
    for x in (cx - half, cx, cx + half):
        r = s(diamond if x == cx else diamond * 0.6)
        draw.polygon(
            [(s(x), y - r), (s(x) + r, y), (s(x), y + r), (s(x) - r, y)],
            fill=color,
        )


# ---------------------------------------------------------------- build
def build():
    canvas = Image.new("RGB", (s(W), s(H)), NAVY)
    draw = ImageDraw.Draw(canvas)

    # --- background: vertical navy gradient + faint warm bloom top-centre
    grad = Image.new("RGB", (1, s(H)))
    gd = ImageDraw.Draw(grad)
    for i in range(s(H)):
        t = i / max(1, s(H) - 1)
        gd.point(
            (0, i),
            tuple(int(a + (b - a) * t) for a, b in zip(NAVY, NAVY_2)),
        )
    canvas.paste(grad.resize((s(W), s(H))), (0, 0))
    canvas = canvas.convert("RGBA")
    canvas.alpha_composite(
        radial_glow((s(W), s(H)), (s(600), s(70)), s(620), GOLD, 26)
    )

    draw = ImageDraw.Draw(canvas)

    # --- gold keyline frame
    draw.rectangle(
        [s(26), s(26), s(W - 26), s(H - 26)],
        outline=GOLD_DEEP + (150,), width=max(1, s(1.5)),
    )
    draw.rectangle(
        [s(33), s(33), s(W - 33), s(H - 33)],
        outline=GOLD + (70,), width=max(1, s(1)),
    )

    # --- fonts
    cinzel = load(instanced_cinzel_bold(), 78)
    cinzel_kick = load(instanced_cinzel_bold(), 18)
    crimson = load(os.path.join(FONT_DIR, "CrimsonText-Regular.ttf"), 22)
    crimson_sm = load(os.path.join(FONT_DIR, "CrimsonText-Regular.ttf"), 19)
    vibes = load(os.path.join(FONT_DIR, "GreatVibes-Regular.ttf"), 50)

    # ================= LEFT COLUMN — brand type =================
    LX = 84

    draw_tracked(draw, (s(LX), s(132)), KICKER, cinzel_kick, GOLD_LIGHT, 4.2)

    y = 214
    for line in TITLE_LINES:
        draw.text((s(LX), s(y)), line, font=cinzel, fill=CREAM, anchor="ls")
        y += 92

    draw.line([(s(LX), s(352)), (s(LX + 108), s(352))], fill=GOLD + (170,),
              width=max(1, s(1.5)))

    draw.text((s(LX), s(415)), TAGLINE, font=vibes, fill=GOLD_LIGHT, anchor="ls")

    cy = 486
    for line in CHARITY_LINES:
        draw.text((s(LX), s(cy)), line, font=crimson, fill=INK_SOFT, anchor="ls")
        cy += 31

    draw_tracked(draw, (s(LX), s(586)), DOMAIN, crimson_sm, GOLD, 1.6)

    # ================= RIGHT COLUMN — framed certificate =================
    card_w = 452
    tmpl = Image.open(TEMPLATE).convert("RGB")
    card_h = int(card_w * tmpl.height / tmpl.width)
    card = tmpl.resize((s(card_w), s(card_h)), Image.LANCZOS)

    card_x = 664
    card_y = int((H - card_h) / 2)

    # warm glow behind the frame
    canvas.alpha_composite(
        radial_glow(
            (s(W), s(H)),
            (s(card_x + card_w / 2), s(card_y + card_h / 2)),
            s(330), GOLD, 40,
        )
    )

    # soft drop shadow
    shadow = Image.new("L", (s(W), s(H)), 0)
    ImageDraw.Draw(shadow).rectangle(
        [s(card_x - 4), s(card_y - 4),
         s(card_x + card_w + 4), s(card_y + card_h + 4)],
        fill=120,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(16)))
    dark = Image.new("RGBA", (s(W), s(H)), (0, 0, 0, 0))
    dark.putalpha(shadow)
    canvas.alpha_composite(dark)

    canvas.paste(card, (s(card_x), s(card_y)))

    # double gold frame around the artwork
    draw = ImageDraw.Draw(canvas)
    draw.rectangle(
        [s(card_x), s(card_y), s(card_x + card_w), s(card_y + card_h)],
        outline=GOLD_LIGHT + (235,), width=max(1, s(2.5)),
    )
    draw.rectangle(
        [s(card_x - 8), s(card_y - 8),
         s(card_x + card_w + 8), s(card_y + card_h + 8)],
        outline=GOLD + (150,), width=max(1, s(1)),
    )

    # --- downsample to the real OG size
    out = canvas.convert("RGB").resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    out.save(OUT, "PNG", optimize=True)
    print(f"wrote {os.path.abspath(OUT)}  ({os.path.getsize(OUT) // 1024} KB, {W}x{H})")


if __name__ == "__main__":
    build()

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { CERTIFICATE_TEMPLATE } from './certificateTemplate';
import { CERTIFICATE_SEAL } from './certificateSeal';
import {
  CinzelBold,
  CinzelDecorativeBold,
  CrimsonBold,
  CrimsonItalic,
  CrimsonRegular,
  GreatVibes,
} from './certificateFonts';
import { BIBLE_TRANSLATION_ABBR, CHARITY_PERCENT, SITE_NAME } from './site';

// ============================================================
// Certificate PDF generation (server-side only).
//
// A US-Letter LANDSCAPE keepsake (792 x 612 pt) built in two layers:
//
//   1. the painted template (gold filigree frame, mountain/lake dawn,
//      dove, and a clean parchment centre panel) drawn full-bleed
//   2. every word of text, drawn as real vector type with embedded
//      Open Font License faces so it stays crisp at any zoom / print size
//
// Both the artwork and the fonts are base64-embedded (see
// assets/make_certificate_template.py and assets/make_font_modules.py)
// because a serverless function cannot rely on reading files at runtime.
//
// Layout constants below are expressed as "top-down" points measured from
// the top edge — Y() flips them into pdf-lib's bottom-up space. They were
// tuned against the parchment panel produced by the template generator
// (panel spans x 168.7..623.3, y 28.8..541.6).
//
// Returns a Uint8Array (the raw PDF bytes).
// ============================================================

const PAGE_W = 792;
const PAGE_H = 612;

// top-down point -> pdf-lib point
const Y = (t) => PAGE_H - t;

// Panel geometry (mirrors PANEL_* in the template generator)
const PANEL_L = 168.7;
const PANEL_R = 623.3;
const PANEL_CX = (PANEL_L + PANEL_R) / 2; // 396
const TEXT_W = 430; // max line width for wrapped body text

// Signature block geometry. The wax seal is centred on the signature rule and
// is 92pt wide (x 350..442), so it splits the rule into two clear columns:
// left 186..350 and right 442..606. Centres therefore sit at PANEL_CX ± 128
// and each column caps at 148pt, keeping a long name clear of the seal.
const SIGN_COL_DX = 128; // column centre offset from page centre
const SIGN_MAX_W = 148; // max drawn width of the name / date

// ---- palette (tuned for legibility on aged parchment) ----
const INK = rgb(0.165, 0.149, 0.125); // #2A2620
const INK_SOFT = rgb(0.396, 0.361, 0.302); // #655C4D
const GOLD_DEEP = rgb(0.478, 0.353, 0.157); // #7A5A28
const GOLD = rgb(0.659, 0.510, 0.239); // #A8823D
const GOLD_LIGHT = rgb(0.788, 0.663, 0.408); // #C9A968

// ---- layout: top-down points ----
const L = {
  kicker: 60,
  titleSmall: 94,
  titleBig: 150,
  titleRule: 196,
  certifies: 220,
  certifiesRule: 240,
  dedicatedTo: 264,
  recipient: 306,
  recipientRule: 330,
  verseTop: 358,
  verseGap: 21,
  reference: 426,
  message: 450,
  signRule: 504,
  signLabel: 522,
  dedicationNo: 558,
};

const b64ToBytes = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));

// Deterministic date formatting (locale-independent, so a certificate rendered
// in any region reads the same). Returns '' for a missing/invalid value.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// ---- text helpers -------------------------------------------------

/** Width of `text` drawn with per-glyph letter-spacing. */
function trackedWidth(font, text, size, track) {
  const chars = [...String(text)];
  if (!chars.length) return 0;
  let w = chars.reduce((a, ch) => a + font.widthOfTextAtSize(ch, size), 0);
  return w + track * (chars.length - 1);
}

/** Draw letter-spaced text centred on `x`. Returns the drawn width. */
function drawTracked(page, text, { x, top, font, size, color, track = 0 }) {
  const w = trackedWidth(font, text, size, track);
  let cx = x - w / 2;
  for (const ch of [...String(text)]) {
    page.drawText(ch, { x: cx, y: Y(top), font, size, color });
    cx += font.widthOfTextAtSize(ch, size) + track;
  }
  return w;
}

/** Greedy word wrap to `maxWidth`. */
function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Centred paragraph of wrapped lines. Returns the y (top-down) after it. */
function drawWrapped(page, text, { top, font, size, color, lineGap = 6, maxWidth = TEXT_W }) {
  const lines = wrapText(text, font, size, maxWidth);
  let y = top;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: PANEL_CX - w / 2, y: Y(y), font, size, color });
    y += size + lineGap;
  }
  return y;
}

/** Horizontal rule with a small centred diamond — the classic divider. */
function ruleWithDiamond(page, top, half, color) {
  const g = 14;
  page.drawLine({
    start: { x: PANEL_CX - half, y: Y(top) },
    end: { x: PANEL_CX - g, y: Y(top) },
    thickness: 1,
    color,
  });
  page.drawLine({
    start: { x: PANEL_CX + g, y: Y(top) },
    end: { x: PANEL_CX + half, y: Y(top) },
    thickness: 1,
    color,
  });
  const r = 3.4;
  page.drawSvgPath(`M ${PANEL_CX} ${Y(top) - r} L ${PANEL_CX + r} ${Y(top)} L ${PANEL_CX} ${Y(top) + r} L ${PANEL_CX - r} ${Y(top)} Z`, {
    color,
  });
}

/** Thin plain rule. */
function rule(page, top, half, color, thickness = 0.9) {
  page.drawLine({
    start: { x: PANEL_CX - half, y: Y(top) },
    end: { x: PANEL_CX + half, y: Y(top) },
    thickness,
    color,
  });
}

/** Largest size <= `start` at which `text` fits `maxWidth`. */
function fitSize(font, text, maxWidth, start, floor = 14) {
  let size = start;
  while (size > floor && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

// ---- main ---------------------------------------------------------

export async function generateCertificatePdf({
  reference,
  verseText,
  recipientName,
  dedicatorName,
  isAnonymous,
  message,
  dedicationNumber,
  date,
} = {}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  pdf.setTitle(`${SITE_NAME} — ${String(reference || '').trim() || 'Certificate of Dedication'}`);
  pdf.setAuthor(SITE_NAME);
  pdf.setSubject('Certificate of Dedication');
  pdf.setCreator(SITE_NAME);

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  // ---- layer 1: painted template
  const bg = await pdf.embedJpg(b64ToBytes(CERTIFICATE_TEMPLATE));
  page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  // ---- fonts
  //
  // `liga: false` on every face.  pdf-lib performs fontkit's ligature
  // substitution and embeds the resulting glyphs, but emits NO ToUnicode entry
  // for them, so any word containing "fl"/"fi"/"ff" is unextractable from the
  // finished PDF — "flesh" extracts as "esh", leaving a 14pt hole in the text
  // layer.  The glyphs still *render*, so this is invisible on screen and only
  // breaks search, copy-paste, and screen readers.  Verified: turning the
  // feature off widens a pair by ~0.1pt and changes the line count of none of
  // the 45 verses (all still fit the 3-line box).
  const TEXT_SAFE = { subset: false, features: { liga: false } };
  const cinzel = await pdf.embedFont(b64ToBytes(CinzelBold), TEXT_SAFE);
  const deco = await pdf.embedFont(b64ToBytes(CinzelDecorativeBold), TEXT_SAFE);
  const crimReg = await pdf.embedFont(b64ToBytes(CrimsonRegular), TEXT_SAFE);
  const crimIt = await pdf.embedFont(b64ToBytes(CrimsonItalic), TEXT_SAFE);
  const crimBold = await pdf.embedFont(b64ToBytes(CrimsonBold), TEXT_SAFE);
  // Great Vibes is a connected cursive face whose `liga`/`calt` substitutions
  // swap in joining glyph variants.  fontkit applies those substitutions but
  // NOT the matching GPOS cursive-attachment positioning, so the variants land
  // on raw advances and names render with visible gaps ("Ben nett").  Turning
  // the two features off yields the correct base glyphs at correct advances.
  const vibes = await pdf.embedFont(b64ToBytes(GreatVibes), {
    subset: false,
    features: { liga: false, calt: false },
  });

  // ---- header
  drawTracked(page, 'A WORD FOR TODAY · A LIGHT FOR TOMORROW', {
    x: PANEL_CX,
    top: L.kicker,
    font: cinzel,
    size: 8.6,
    color: INK_SOFT,
    track: 1.9,
  });
  const kickW = trackedWidth(cinzel, 'A WORD FOR TODAY · A LIGHT FOR TOMORROW', 8.6, 1.9);
  page.drawLine({
    start: { x: PANEL_CX - kickW / 2 - 30, y: Y(L.kicker) },
    end: { x: PANEL_CX - kickW / 2 - 10, y: Y(L.kicker) },
    thickness: 0.8,
    color: GOLD,
  });
  page.drawLine({
    start: { x: PANEL_CX + kickW / 2 + 10, y: Y(L.kicker) },
    end: { x: PANEL_CX + kickW / 2 + 30, y: Y(L.kicker) },
    thickness: 0.8,
    color: GOLD,
  });

  drawTracked(page, 'CERTIFICATE OF', {
    x: PANEL_CX,
    top: L.titleSmall,
    font: cinzel,
    size: 16.5,
    color: INK,
    track: 4.2,
  });

  // big decorative word, with a warm highlight so it reads as gilded
  const bigSize = fitSize(deco, 'DEDICATION', 470, 60, 30);
  const bigW = deco.widthOfTextAtSize('DEDICATION', bigSize);
  page.drawText('DEDICATION', {
    x: PANEL_CX - bigW / 2 + 0.8,
    y: Y(L.titleBig) - 1.1,
    font: deco,
    size: bigSize,
    color: GOLD_LIGHT,
  });
  page.drawText('DEDICATION', {
    x: PANEL_CX - bigW / 2,
    y: Y(L.titleBig),
    font: deco,
    size: bigSize,
    color: GOLD_DEEP,
  });

  ruleWithDiamond(page, L.titleRule, 132, GOLD);

  drawTracked(page, 'THIS CERTIFIES THAT', {
    x: PANEL_CX,
    top: L.certifies,
    font: cinzel,
    size: 10.4,
    color: INK_SOFT,
    track: 3,
  });
  rule(page, L.certifiesRule, 70, GOLD);

  drawTracked(page, 'HAS DEDICATED A BIBLE VERSE TO', {
    x: PANEL_CX,
    top: L.dedicatedTo,
    font: cinzel,
    size: 8.8,
    color: INK_SOFT,
    track: 2.4,
  });

  // ---- recipient name (script)
  // Only ever draw a name the buyer actually supplied. The recipient is
  // required at checkout, so an empty value means something upstream went
  // wrong — draw nothing rather than inventing a name onto a keepsake.
  const name = String(recipientName || '').trim();
  if (name) {
    const nameSize = fitSize(vibes, name, 400, 50, 22);
    page.drawText(name, {
      x: PANEL_CX - vibes.widthOfTextAtSize(name, nameSize) / 2,
      y: Y(L.recipient),
      font: vibes,
      size: nameSize,
      color: GOLD_DEEP,
    });
  }
  rule(page, L.recipientRule, 120, GOLD_LIGHT, 0.7);

  // ---- verse body
  let verseBottom = L.verseTop;
  const quote = String(verseText || '').trim();
  if (quote) {
    // Keep the longest quotations inside the space above the signature block.
    const maxLines = 3;
    let size = 11.8;
    let lines = wrapText(`“${quote}”`, crimIt, size, TEXT_W);
    while (lines.length > maxLines && size > 9) {
      size -= 0.4;
      lines = wrapText(`“${quote}”`, crimIt, size, TEXT_W);
    }
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    let y = L.verseTop;
    for (const line of lines) {
      const w = crimIt.widthOfTextAtSize(line, size);
      page.drawText(line, { x: PANEL_CX - w / 2, y: Y(y), font: crimIt, size, color: INK });
      y += L.verseGap;
    }
    verseBottom = y;
  }

  // Only draw a reference if the buyer actually chose one.
  const refText = String(reference || '').trim().toUpperCase();
  const refTop = Math.max(verseBottom + 10, L.reference);
  if (refText) {
    drawTracked(page, refText, {
      x: PANEL_CX,
      top: refTop,
      font: cinzel,
      size: 9.6,
      color: GOLD_DEEP,
      track: 2.2,
    });
  }

  // ---- personal message
  const note = String(message || '').trim();
  if (note) {
    drawWrapped(page, note, {
      top: Math.max(refTop + 22, L.message),
      font: crimIt,
      size: 10,
      color: INK_SOFT,
      lineGap: 4.4,
      maxWidth: 380,
    });
  }

  // ---- signature block + wax seal
  // The rule runs 186..606 and the seal overlays its centre (350..442),
  // leaving two usable columns either side.
  rule(page, L.signRule, 210, GOLD_LIGHT, 0.9);
  drawTracked(page, 'DEDICATED BY', {
    x: PANEL_CX - SIGN_COL_DX,
    top: L.signLabel,
    font: cinzel,
    size: 7.6,
    color: INK_SOFT,
    track: 1.8,
  });
  drawTracked(page, 'DATE', {
    x: PANEL_CX + SIGN_COL_DX,
    top: L.signLabel,
    font: cinzel,
    size: 7.6,
    color: INK_SOFT,
    track: 1.8,
  });

  // the dedicator's own name, script, resting on the rule
  const signer = isAnonymous ? 'Anonymous' : String(dedicatorName || '').trim();
  if (signer) {
    const sSize = fitSize(vibes, signer, SIGN_MAX_W, 24, 12);
    const sW = vibes.widthOfTextAtSize(signer, sSize);
    page.drawText(signer, {
      x: PANEL_CX - SIGN_COL_DX - sW / 2,
      y: Y(L.signRule - 6),
      font: vibes,
      size: sSize,
      color: INK,
    });
  }

  // the date it was given, mirroring the signature on the right column
  const dateStr = formatDate(date);
  if (dateStr) {
    const dSize = fitSize(crimReg, dateStr, SIGN_MAX_W, 12, 8);
    const dW = crimReg.widthOfTextAtSize(dateStr, dSize);
    page.drawText(dateStr, {
      x: PANEL_CX + SIGN_COL_DX - dW / 2,
      y: Y(L.signRule - 6),
      font: crimReg,
      size: dSize,
      color: INK,
    });
  }

  const seal = await pdf.embedPng(b64ToBytes(CERTIFICATE_SEAL));
  const sealW = 92;
  page.drawImage(seal, {
    x: PANEL_CX - sealW / 2,
    y: Y(L.signRule) - sealW / 2,
    width: sealW,
    height: sealW,
  });

  // ---- footer line
  // The chosen reference is already displayed prominently above the quotation,
  // so it is not repeated here — this line only identifies the certificate.
  if (dedicationNumber) {
    const bits = [`DEDICATION NO. ${String(dedicationNumber).padStart(4, '0')}`];
    bits.push(`${BIBLE_TRANSLATION_ABBR}`);
    drawTracked(page, bits.join('  ·  '), {
      x: PANEL_CX,
      top: L.dedicationNo,
      font: cinzel,
      size: 7.2,
      color: INK_SOFT,
      track: 1.6,
    });
  }

  drawTracked(page, `${CHARITY_PERCENT}% OF THIS PURCHASE SUPPORTS BIBLE TRANSLATION`, {
    x: PANEL_CX,
    top: L.dedicationNo + 15,
    font: cinzel,
    size: 6.4,
    color: GOLD_DEEP,
    track: 1.3,
  });

  return pdf.save();
}

export default generateCertificatePdf;

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SITE_NAME, BIBLE_TRANSLATION, CHARITY_PERCENT, siteUrl } from './site';

// ============================================================
// Certificate PDF generation (server-side only).
//
// Uses pdf-lib (pure JS, no native deps) so it runs anywhere
// Node runs — including serverless functions.
//
// Produces a US Letter portrait certificate:
//   - double gold rule border
//   - "Certificate of Dedication" kicker
//   - recipient name
//   - the verse text + reference
//   - optional personal message
//   - dedicator line (or "Anonymous")
//
// Returns a Uint8Array (the raw PDF bytes).
// ============================================================

const PAGE_W = 612; // 8.5in * 72
const PAGE_H = 792; // 11in * 72

const CREAM = rgb(0.957, 0.933, 0.878); // #F4EEE0
const CARD = rgb(0.984, 0.973, 0.941); // #FBF8F0
const INK = rgb(0.165, 0.149, 0.125); // #2A2620
const INK_SOFT = rgb(0.361, 0.337, 0.29); // #5C564A
const GOLD = rgb(0.659, 0.51, 0.239); // #A8823D
const GOLD_LIGHT = rgb(0.788, 0.663, 0.408); // #C9A968
const GOLD_TEXT = rgb(0.478, 0.373, 0.173); // #7A5F2C

// Wrap text to a max width, returning an array of lines.
function wrap(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCenteredWrapped(page, text, { font, size, color, centerX, top, maxWidth, lineGap = 4 }) {
  const lines = wrap(text, font, size, maxWidth);
  const lineHeight = size + lineGap;
  let y = top;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: centerX - w / 2, y, size, font, color });
    y -= lineHeight;
  }
  return y; // returns the y after the last line (for chaining)
}

export async function generateCertificatePdf({
  reference,
  verseText,
  recipientName,
  dedicatorName,
  isAnonymous,
  message,
  dedicationNumber,
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of Dedication — ${reference}`);
  pdf.setAuthor(SITE_NAME);
  pdf.setSubject(`A dedication of ${reference} (${BIBLE_TRANSLATION})`);
  pdf.setCreator(SITE_NAME);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });

  // Inner card
  const cardPad = 40;
  page.drawRectangle({
    x: cardPad,
    y: cardPad,
    width: PAGE_W - cardPad * 2,
    height: PAGE_H - cardPad * 2,
    color: CARD,
  });

  // Double gold border
  const outer = 26;
  page.drawRectangle({
    x: outer,
    y: outer,
    width: PAGE_W - outer * 2,
    height: PAGE_H - outer * 2,
    borderColor: GOLD,
    borderWidth: 2,
  });
  const innerOff = 34;
  page.drawRectangle({
    x: innerOff,
    y: innerOff,
    width: PAGE_W - innerOff * 2,
    height: PAGE_H - innerOff * 2,
    borderColor: GOLD_LIGHT,
    borderWidth: 0.75,
  });

  const cx = PAGE_W / 2;
  const contentMax = PAGE_W - 180;
  let y = PAGE_H - 120;

  // Small cross mark
  const markColor = GOLD;
  page.drawLine({ start: { x: cx, y: y + 18 }, end: { x: cx, y: y - 20 }, thickness: 1.4, color: markColor });
  page.drawLine({ start: { x: cx - 9, y: y - 2 }, end: { x: cx + 9, y: y - 2 }, thickness: 1.4, color: markColor });
  y -= 44;

  // Brand
  const brandSize = 12;
  const brandW = sans.widthOfTextAtSize(SITE_NAME.toUpperCase(), brandSize);
  page.drawText(SITE_NAME.toUpperCase(), {
    x: cx - brandW / 2,
    y,
    size: brandSize,
    font: sans,
    color: GOLD_TEXT,
  });
  y -= 26;

  // Kicker
  const kickerSize = 22;
  const kicker = 'Certificate of Dedication';
  const kickerW = serifBold.widthOfTextAtSize(kicker, kickerSize);
  page.drawText(kicker, { x: cx - kickerW / 2, y, size: kickerSize, font: serifBold, color: INK });
  y -= 46;

  // "This verse is dedicated to"
  const toLine = 'This verse is dedicated to';
  const toSize = 13;
  const toW = serifItalic.widthOfTextAtSize(toLine, toSize);
  page.drawText(toLine, { x: cx - toW / 2, y, size: toSize, font: serifItalic, color: INK_SOFT });
  y -= 40;

  // Recipient name (large). Shrink if very long.
  const name = (recipientName || 'Their name').trim();
  let nameSize = 40;
  while (serifBold.widthOfTextAtSize(name, nameSize) > contentMax && nameSize > 18) {
    nameSize -= 2;
  }
  const nameW = serifBold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, { x: cx - nameW / 2, y, size: nameSize, font: serifBold, color: GOLD_TEXT });
  y -= 54;

  // Divider
  page.drawLine({ start: { x: cx - 60, y }, end: { x: cx + 60, y }, thickness: 0.75, color: GOLD_LIGHT });
  y -= 40;

  // Verse text (italic, wrapped, centered)
  const verseSize = 15;
  const verseTop = y;
  const afterVerse = drawCenteredWrapped(page, `\u201C${verseText}\u201D`, {
    font: serifItalic,
    size: verseSize,
    color: INK,
    centerX: cx,
    top: verseTop,
    maxWidth: contentMax,
    lineGap: 6,
  });
  y = afterVerse - 10;

  // Reference
  const refSize = 15;
  const refW = serifBold.widthOfTextAtSize(`— ${reference}`, refSize);
  page.drawText(`— ${reference}`, { x: cx - refW / 2, y, size: refSize, font: serifBold, color: GOLD_TEXT });
  y -= 34;

  // Translation note
  const tn = BIBLE_TRANSLATION;
  const tnSize = 10;
  const tnW = sansOblique.widthOfTextAtSize(tn, tnSize);
  page.drawText(tn, { x: cx - tnW / 2, y, size: tnSize, font: sansOblique, color: INK_SOFT });
  y -= 40;

  // Optional personal message
  if (message && message.trim()) {
    const afterMsg = drawCenteredWrapped(page, `\u201C${message.trim()}\u201D`, {
      font: serifItalic,
      size: 12,
      color: INK_SOFT,
      centerX: cx,
      top: y,
      maxWidth: contentMax - 40,
      lineGap: 4,
    });
    y = afterMsg - 26;
  }

  // From line
  const fromName = isAnonymous || !dedicatorName || !dedicatorName.trim() ? 'Anonymous' : dedicatorName.trim();
  const fromLine = `dedicated by ${fromName}`;
  const fromSize = 12;
  const fromW = sans.widthOfTextAtSize(fromLine, fromSize);
  page.drawText(fromLine, { x: cx - fromW / 2, y, size: fromSize, font: sans, color: INK_SOFT });

  // Footer
  const footerY = 76;
  if (dedicationNumber) {
    const nText = `Dedication No. ${dedicationNumber}`;
    const nSize = 9;
    const nW = sans.widthOfTextAtSize(nText, nSize);
    page.drawText(nText, { x: cx - nW / 2, y: footerY + 16, size: nSize, font: sans, color: GOLD_TEXT });
  }
  const footnote = `${CHARITY_PERCENT}% of this dedication supports Bible translation · ${siteUrl()}`;
  const fSize = 8;
  const fW = sans.widthOfTextAtSize(footnote, fSize);
  page.drawText(footnote, { x: cx - fW / 2, y: footerY, size: fSize, font: sans, color: INK_SOFT });

  return await pdf.save();
}

// ============================================================
// Pure text helpers — safe to import from client components.
// (Nothing here touches Supabase or any server-only module.)
// ============================================================

// A short, word-boundary-safe preview of text.
export function snippetOf(text, len = 90) {
  const t = String(text || '').trim();
  if (t.length <= len) return t;
  const cut = t.slice(0, len);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : len)}…`;
}

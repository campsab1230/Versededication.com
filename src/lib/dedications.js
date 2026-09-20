import { supabaseAdmin } from './supabaseAdmin';

// ============================================================
// Insert a dedication with a per-verse sequential number,
// safely under concurrency.
//
// The DB trigger assigns dedication_number = max+1, but under
// concurrent inserts two rows can collide. We added a unique
// constraint on (verse_id, dedication_number) in the schema, so
// a collision raises a unique-violation (Postgres code 23505).
// We retry a few times to let the other transaction commit.
// ============================================================

const MAX_ATTEMPTS = 5;

export async function insertDedication(payload) {
  const db = supabaseAdmin();
  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await db
      .from('dedications')
      .insert(payload)
      .select('id, dedication_number')
      .single();

    if (!error) return data;

    lastError = error;
    // 23505 = unique_violation → race on dedication_number; retry.
    const isUniqueViolation =
      error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '');
    if (!isUniqueViolation) throw error;

    // Small backoff before retrying.
    await sleep(40 * (attempt + 1));
  }

  throw lastError || new Error('insertDedication: exhausted retries');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

#!/usr/bin/env bash
# ============================================================
# Generates db/setup.sql — schema.sql followed by seed.sql, in
# the correct order, as ONE paste-able file.
#
# db/schema.sql and db/seed.sql remain the single source of truth.
# db/setup.sql is a generated convenience copy for people running
# it by hand in the Supabase SQL editor. Do not edit it directly:
# edit schema.sql / seed.sql and re-run this script.
#
#   bash scripts/make-setup-sql.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

OUT=db/setup.sql

{
  echo "-- ============================================================"
  echo "-- GENERATED FILE — DO NOT EDIT."
  echo "--"
  echo "-- This is db/schema.sql followed by db/seed.sql, so it can be"
  echo "-- pasted into the Supabase SQL editor in one go."
  echo "--"
  echo "-- Regenerate with:  bash scripts/make-setup-sql.sh"
  echo "-- Edit schema.sql / seed.sql instead, never this file."
  echo "-- ============================================================"
  echo
  cat db/schema.sql
  echo
  echo
  cat db/seed.sql
} > "$OUT"

lines=$(wc -l < "$OUT")
echo "wrote $OUT ($lines lines)"

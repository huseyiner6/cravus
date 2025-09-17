#!/usr/bin/env bash
set -euo pipefail

REF=""
OUT="cloud_audit_$(date +%Y%m%d_%H%M%S).txt"
SCHEMAS="public,graphql_public,storage"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref|-r) REF="${2:-}"; shift 2 ;;
    --out|-o) OUT="${2:-}"; shift 2 ;;
    --schemas) SCHEMAS="${2:-}"; shift 2 ;;
    --help|-h) echo "Usage: $0 [--ref <PROJECT_REF>] [--out <TXT>] [--schemas <list>]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

log(){ printf "%s\n" "$*"; }
hdr(){ printf "\n== %s ==\n\n" "$*"; }
redact(){ sed -E 's/(eyJ[A-Za-z0-9_\-]{8})[A-Za-z0-9_\-]+/\1...REDACTED.../g'; }

{
  hdr "Project"
  if [[ -n "${REF}" ]]; then
    log "Project Ref = ${REF}"
    log "API URL     = https://${REF}.supabase.co"
  else
    log "Project Ref = (linked project)"
    log "API URL     = (from link)"
  fi

  find supabase/migrations -name ".DS_Store" -delete 2>/dev/null || true

  hdr "supabase migration list (remote + local)"
  supabase migration list || true

  hdr "Edge Functions (deployed)"
  if [[ -n "${REF}" ]]; then supabase functions list --project-ref "${REF}" || true
  else supabase functions list || true; fi

  hdr "Supabase secrets (NAMES ONLY)"
  if [[ -n "${REF}" ]]; then supabase secrets list --project-ref "${REF}" || true
  else supabase secrets list || true; fi

  hdr "Dump remote schema to file"
  mkdir -p supabase

  # REF verildiyse link’i güncelle (dump --project-ref desteklemez)
  if [[ -n "${REF}" ]]; then supabase link --project-ref "${REF}" >/dev/null 2>&1 || true; fi

  # Şifre verdin ise prompt olmasın
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    supabase db dump --linked --schema "${SCHEMAS}" -p "${SUPABASE_DB_PASSWORD}" --file supabase/_remote_schema.sql \
      && log "wrote: supabase/_remote_schema.sql" || log "ERROR: db dump failed"
  else
    supabase db dump --linked --schema "${SCHEMAS}" --file supabase/_remote_schema.sql \
      && log "wrote: supabase/_remote_schema.sql" || log "ERROR: db dump failed"
  fi
} | redact | tee "${OUT}"

log ""
log "Audit summary saved → ${OUT}"

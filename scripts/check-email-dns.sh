#!/usr/bin/env bash
# ============================================================
# check-email-dns.sh — verify the Resend sending setup for a domain.
#
# Written after both DKIM records at resend._domainkey were accidentally
# deleted from Cloudflare. This reports, for each record Resend needs,
# whether it exists and whether it looks structurally correct.
#
# Email keeps SENDING without DKIM — it just loses its signature and gets
# spam-foldered more often. SPF alone is not enough for Gmail/Outlook.
#
# Usage:
#   ./scripts/check-email-dns.sh                    # default domain
#   ./scripts/check-email-dns.sh example.com
#
# Exits 0 only if DKIM, SPF and MX are all present and well-formed.
# ============================================================
set -uo pipefail

DOMAIN="${1:-versededication.com}"
DOH="https://cloudflare-dns.com/dns-query"

# dig is unreliable in some sandboxes; use DNS-over-HTTPS instead.
q() { # q <name> <type> -> newline-separated record data
  curl -s --max-time 10 "$DOH?name=$1&type=$2" -H 'accept: application/dns-json' \
    | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for a in d.get('Answer', []):
    if a.get('type') == {'TXT':16,'MX':15,'A':1,'CNAME':5}.get(sys.argv[1], 0):
        print(a.get('data',''))
" "$2"
}

status() { # status <name> -> NOERROR / NXDOMAIN / other
  curl -s --max-time 10 "$DOH?name=$1&type=TXT" -H 'accept: application/dns-json' \
    | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: print('UNREACHABLE'); raise SystemExit
print({0:'NOERROR',3:'NXDOMAIN',2:'SERVFAIL'}.get(d.get('Status'), d.get('Status')))
"
}

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail+1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }

echo
echo "Resend sending DNS — $DOMAIN"
echo "======================================================"

# ---------- 1. DKIM ----------
echo
echo "1) DKIM  (resend._domainkey.$DOMAIN)"
DKIM_NAME="resend._domainkey.$DOMAIN"
dkim_rows=$(q "$DKIM_NAME" TXT)

if [ -z "$dkim_rows" ]; then
  bad "no TXT record — DKIM signing is OFF, mail will be spam-foldered"
  echo "        status: $(status "$DKIM_NAME")"
  echo "        fix: resend.com -> Domains -> $DOMAIN -> copy the DKIM record"
  echo "             -> Cloudflare DNS: Type TXT, Name resend._domainkey"
else
  n=$(printf '%s\n' "$dkim_rows" | grep -c .)
  val=$(printf '%s\n' "$dkim_rows" | head -1 | tr -d '"')
  len=${#val}
  if [ "$n" -gt 1 ]; then
    bad "$n TXT records at one selector — verification is undefined; keep exactly ONE"
  elif [[ "$val" != p=* ]]; then
    bad "value does not start with 'p=' — wrong record pasted?"
  elif [ "$len" -lt 180 ]; then
    warn "value is only $len chars — expected ~218 for a 1024-bit key (truncated?)"
  else
    ok "one well-formed record (${len} chars, ends ...${val: -14})"
  fi
fi

# ---------- 2. SPF ----------
echo
echo "2) SPF   (send.$DOMAIN)"
spf=$(q "send.$DOMAIN" TXT | tr -d '"' | grep '^v=spf1' || true)
if [ -z "$spf" ]; then
  bad "no v=spf1 record on the send subdomain — SPF will fail"
else
  ok "present: ${spf:0:70}"
fi

# ---------- 3. MX (bounce handling) ----------
echo
echo "3) MX    (send.$DOMAIN)"
mx=$(q "send.$DOMAIN" MX)
if [ -z "$mx" ]; then
  bad "no MX — Resend cannot receive bounces/complaints"
else
  ok "$(printf '%s' "$mx" | grep -c .) record(s): $(printf '%s' "$mx" | head -1)"
fi

# ---------- 4. DMARC (optional, recommended) ----------
echo
echo "4) DMARC (_dmarc.$DOMAIN)   [recommended, not required]"
dmarc=$(q "_dmarc.$DOMAIN" TXT | tr -d '"' | grep '^v=DMARC1' || true)
if [ -z "$dmarc" ]; then
  warn "none — not an error, but inboxes prefer a policy. Start with v=DMARC1; p=none"
else
  ok "present: ${dmarc:0:70}"
fi

# ---------- verdict ----------
echo
echo "======================================================"
if [ "$fail" -eq 0 ]; then
  printf '\033[32mAll required records present.\033[0m\n'
  exit 0
else
  printf '\033[31m%d check(s) failing.\033[0m  DKIM must be restored before transactional\n' "$fail"
  echo "email (certificates, verse requests) can be trusted to reach inboxes."
  exit 1
fi

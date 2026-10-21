#!/bin/sh
# Nightly logical backup. Usage: DATABASE_URL=postgres://... sh server/backup.sh [outdir]
set -e
OUT="${1:-./backups}"; mkdir -p "$OUT"
F="$OUT/zksurvey-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$F" && echo "backup written: $F"
# keep the 14 newest
ls -1t "$OUT"/zksurvey-*.sql.gz | tail -n +15 | xargs -r rm -f

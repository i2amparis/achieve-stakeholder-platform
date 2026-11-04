#!/bin/sh
# Daily backup of the database and Directus uploads. Keeps 14 days.
# Run from the repository on the server, e.g. from cron:
#   15 3 * * * cd /opt/achieve && ./deploy/backup.sh >> /var/log/achieve-backup.log 2>&1
# Backups contain feedback responses (personal data): keep them on the server or in
# EU storage only, and delete them on the same schedule as the data itself.
set -eu
DIR="${BACKUP_DIR:-/var/backups/achieve}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DIR" && chmod 700 "$DIR"
. ./.env
docker compose -f docker-compose.prod.yml exec -T database pg_dump -U "$DB_USER" -d "$DB_DATABASE" --format=custom > "$DIR/db_$STAMP.dump"
docker run --rm -v achieve_uploads:/uploads:ro -v "$DIR":/backup alpine:3.22 tar czf "/backup/uploads_$STAMP.tgz" -C /uploads .
find "$DIR" -type f -mtime +14 -delete
echo "$(date -Iseconds) backup ok: $DIR/db_$STAMP.dump"

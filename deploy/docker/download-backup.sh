#!/bin/sh
# Download the pinned public demonstration snapshot, never a live Azure database.
set -eu

backup_dir=${1:-/backup}
backup="$backup_dir/QMAH.bak"
url=${QMAH_BACKUP_URL:-https://github.com/MSIT173-03/QMAH-Database/releases/download/db-v1.0.10/QMAH-1.0.10.bak}
sha256=${QMAH_BACKUP_SHA256:-9adea6bd83a8a720dbb2749c60b28bd773076b22eb6b9083a3c5f02cb074244f}

verify() {
    printf '%s  %s\n' "$sha256" "$1" | sha256sum -c - >/dev/null 2>&1
}

mkdir -p "$backup_dir"
if [ -f "$backup" ] && verify "$backup"; then
    echo 'QMAH database snapshot checksum verified (cached).'
    exit 0
fi

temporary="$backup.part.$$"
trap 'rm -f "$temporary"' EXIT HUP INT TERM
curl --fail --location --retry 3 --connect-timeout 15 --max-time 300 \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --output "$temporary" "$url"
if ! verify "$temporary"; then
    echo 'QMAH database snapshot SHA-256 mismatch; restore blocked.' >&2
    exit 1
fi
if [ -e "$backup" ]; then
    preserved="$backup.unverified.$$"
    if [ -e "$preserved" ]; then echo 'Unverified backup destination already exists.' >&2; exit 1; fi
    mv "$backup" "$preserved"
    echo 'Previous unverified backup preserved for manual inspection.'
fi
mv -f "$temporary" "$backup"
echo 'QMAH database snapshot downloaded and checksum verified.'

#!/usr/bin/env bash
set -Eeuo pipefail

# Updates application files only. Database, environment files, uploads and keys stay in place.
archive="${1:?Archive required}"
revision="${2:?Git revision required}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/qmah-update.lock
flock -w 300 9
root=/opt/qmah
release="$root/releases/$revision"
[[ ! -e "$release" ]] || { echo 'Release already exists; refusing to overwrite rollback files.'; exit 2; }
mkdir -p "$release/new" "$release/previous"
tar -xzf "$archive" -C "$release/new"
test -f "$release/new/client/index.html"
test -f "$release/new/api/QMAH.Api"
test -f "$release/new/web/QMAH.Web"
test -f "$release/new/deploy/Caddyfile"
export QMAH_HOST=qmah.eastus.cloudapp.azure.com
caddy validate --config "$release/new/deploy/Caddyfile" --adapter caddyfile
chmod +x "$release/new/api/QMAH.Api" "$release/new/web/QMAH.Web"
chown -R qmah:qmah "$release/new/api" "$release/new/web"
chmod -R o+rX "$release/new/client"

# Old tabs may still import a lazy chunk from the preceding build.
for source in "$root/client" "$root/client-before-catalog-repair"; do
    if [[ -d "$source" ]]; then
        find "$source" -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' \) -exec cp -n -t "$release/new/client" {} +
    fi
done
cp /etc/caddy/Caddyfile "$release/previous/Caddyfile"
swapped=()
rollback() {
    local status=$?
    trap - ERR
    echo 'Deployment failed; restoring the preceding application version.'
    for name in "${swapped[@]}"; do
        if [[ -e "$root/$name" ]]; then mv "$root/$name" "$release/failed-$name"; fi
        mv "$release/previous/$name" "$root/$name"
    done
    cp "$release/previous/Caddyfile" /etc/caddy/Caddyfile
    systemctl restart qmah-api qmah-web
    systemctl reload caddy
    systemctl start qmah-health.timer
    exit "$status"
}
trap rollback ERR
systemctl stop qmah-health.timer
for name in api web client; do
    mv "$root/$name" "$release/previous/$name"
    swapped+=("$name")
    mv "$release/new/$name" "$root/$name"
done
install -m 644 "$release/new/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl restart qmah-api qmah-web
systemctl reload caddy
ready=false
for attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 -H "Host: $QMAH_HOST" http://127.0.0.1:5101/api/v1/account/capabilities >/dev/null \
        && curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/home" >/dev/null \
        && curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/admin/" >/dev/null; then
        ready=true
        break
    fi
    sleep 2
done
[[ "$ready" == true ]]
if [[ -d "$release/new/media" ]]; then
    for name in images fonts; do
        if [[ -d "$release/new/media/$name" ]]; then
            mkdir -p "$root/QMAH.Media/$name"
            cp -a "$release/new/media/$name/." "$root/QMAH.Media/$name/"
            chown -R qmah:qmah "$root/QMAH.Media/$name"
        fi
    done
fi
systemctl start qmah-health.timer
printf '%s\n' "$revision" > "$root/current-revision"
trap - ERR
echo "QMAH_UPDATE_OK $revision"

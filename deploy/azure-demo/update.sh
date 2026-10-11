#!/usr/bin/env bash
set -Eeuo pipefail

# Updates application files only. Database, environment files, uploads and keys stay in place.
archive="${1:?Archive required}"
revision="${2:?Git revision required}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 2
exec 9>/var/lock/qmah-update.lock
flock -w 300 9
root=/opt/qmah
[[ $(df --output=avail -k "$root" | tail -1) -ge 1048576 ]] || { echo 'Less than 1 GiB free; keeping the current application.'; exit 1; }
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
        find "$source" -maxdepth 1 -type f -mtime -14 \( -name '*.js' -o -name '*.css' \) -exec cp -p --update=none -t "$release/new/client" {} +
    fi
done
cp /etc/caddy/Caddyfile "$release/previous/Caddyfile"
cp /etc/systemd/system/qmah-api.service /etc/systemd/system/qmah-web.service "$release/previous/"
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
    cp "$release/previous/qmah-api.service" "$release/previous/qmah-web.service" /etc/systemd/system/
    systemctl daemon-reload
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
install -m 644 "$release/new/deploy/qmah-api.service" "$release/new/deploy/qmah-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl restart qmah-api qmah-web
systemctl reload caddy
ready=false
for attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/api/v1/account/capabilities" >/dev/null \
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
install -m 755 "$release/new/deploy/backup-database.sh" "$root/deploy/backup-database.sh"
install -m 644 "$release/new/deploy/qmah-backup.service" "$release/new/deploy/qmah-backup.timer" /etc/systemd/system/
mkdir -p /etc/systemd/journald.conf.d
install -m 644 "$release/new/deploy/qmah-journald.conf" /etc/systemd/journald.conf.d/qmah-demo.conf
systemctl daemon-reload
systemctl enable --now qmah-backup.timer
systemctl restart systemd-journald
printf '%s\n' "$revision" > "$root/current-revision"
trap - ERR
# Keep three releases. A validated SHA directory cannot point outside our release root.
while read -r old; do
    [[ "$old" =~ ^[0-9a-f]{40}$ && "$old" != "$revision" ]] || continue
    [[ "$(realpath "$root/releases/$old")" == "$root/releases/$old" ]] || continue
    rm -rf -- "$root/releases/$old"
done < <(find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -nr | cut -d' ' -f2 | tail -n +4)
if [[ "$archive" == "/tmp/qmah-update-$revision.tar.gz" ]]; then rm -f -- "$archive" "/tmp/qmah-update-$revision.sh"; fi
echo "QMAH_UPDATE_OK $revision"

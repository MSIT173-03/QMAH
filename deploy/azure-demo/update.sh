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
# Health scripts were previously installed only by bootstrap, so later fixes
# never reached the running VM. Preserve their old versions for rollback.
cp -a "$root/deploy" "$release/previous/deploy"
cp /etc/systemd/system/qmah-health.service /etc/systemd/system/qmah-health.timer "$release/previous/"
application_ready() {
    # Reading catalog data exercises the database, unlike account capabilities.
    curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/api/v1/catalog/artifacts?pageSize=1" >/dev/null \
        && curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/home" >/dev/null \
        && curl -fsS --max-time 5 --resolve "$QMAH_HOST:443:127.0.0.1" "https://$QMAH_HOST/admin/Account/Login" >/dev/null
}
rollback() {
    local status="${1:-1}" recovery_ok=true
    trap - ERR HUP INT TERM
    set +e
    echo 'Deployment failed; restoring the preceding application version.'
    # An interruption can arrive after mv but before bookkeeping runs. The
    # presence of the preserved directory is the source of truth for rollback.
    for name in api web client; do
        if [[ -e "$release/previous/$name" ]]; then
            if [[ -e "$root/$name" ]]; then
                mv "$root/$name" "$release/failed-$name" || recovery_ok=false
            fi
            mv "$release/previous/$name" "$root/$name" || recovery_ok=false
        fi
    done
    cp "$release/previous/Caddyfile" /etc/caddy/Caddyfile || recovery_ok=false
    cp "$release/previous/qmah-api.service" "$release/previous/qmah-web.service" /etc/systemd/system/ || recovery_ok=false
    cp "$release/previous/qmah-health.service" "$release/previous/qmah-health.timer" /etc/systemd/system/ || recovery_ok=false
    cp -a "$release/previous/deploy/." "$root/deploy/" || recovery_ok=false
    systemctl daemon-reload || recovery_ok=false
    systemctl restart qmah-api qmah-web || recovery_ok=false
    systemctl reload caddy || recovery_ok=false
    systemctl start qmah-health.timer || recovery_ok=false
    local recovered=false
    for attempt in $(seq 1 30); do
        if application_ready; then recovered=true; break; fi
        sleep 2
    done
    [[ "$recovered" == true ]] || recovery_ok=false
    if [[ "$recovery_ok" != true ]]; then
        echo 'QMAH_ROLLBACK_FAILED: preserved files remain available for recovery.'
    else
        echo 'QMAH_ROLLBACK_OK'
    fi
    exit "$status"
}
trap 'rollback $?' ERR
trap 'rollback 129' HUP
trap 'rollback 130' INT
trap 'rollback 143' TERM
systemctl stop qmah-health.timer
for name in api web client; do
    mv "$root/$name" "$release/previous/$name"
    mv "$release/new/$name" "$root/$name"
done
install -m 644 "$release/new/deploy/Caddyfile" /etc/caddy/Caddyfile
install -m 644 "$release/new/deploy/qmah-api.service" "$release/new/deploy/qmah-web.service" /etc/systemd/system/
install -m 755 "$release/new/deploy/health-recover.sh" "$root/deploy/health-recover.sh"
install -m 644 "$release/new/deploy/qmah-health.service" "$release/new/deploy/qmah-health.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl restart qmah-api qmah-web
systemctl reload caddy
ready=false
for attempt in $(seq 1 30); do
    if application_ready; then
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
trap - ERR HUP INT TERM
# Keep three releases. A validated SHA directory cannot point outside our release root.
while read -r old; do
    [[ "$old" =~ ^[0-9a-f]{40}$ && "$old" != "$revision" ]] || continue
    [[ "$(realpath "$root/releases/$old")" == "$root/releases/$old" ]] || continue
    rm -rf -- "$root/releases/$old"
done < <(find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -nr | cut -d' ' -f2 | tail -n +4)
if [[ "$archive" == "/tmp/qmah-update-$revision.tar.gz" ]]; then rm -f -- "$archive" "/tmp/qmah-update-$revision.sh"; fi
echo "QMAH_UPDATE_OK $revision"

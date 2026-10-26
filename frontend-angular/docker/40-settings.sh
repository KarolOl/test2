#!/bin/sh
set -eu

target=/usr/share/nginx/html/settings.json
source_file="${SETTINGS_FILE:-/etc/app/settings.json}"
temporary="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT HUP INT TERM

if [ "${SETTINGS_JSON+x}" = x ]; then
    printf '%s\n' "$SETTINGS_JSON" > "$temporary"
elif [ -f "$source_file" ]; then
    cat "$source_file" > "$temporary"
elif [ -n "${SETTINGS_FILE:-}" ]; then
    echo "Settings file does not exist: $source_file" >&2
    exit 1
else
    cat /opt/app/settings.default.json > "$temporary"
fi

if ! awk -f /opt/app/settings.awk "$temporary" > /dev/null; then
    echo 'Settings must contain one valid JSON object with safe API and Keycloak URLs.' >&2
    exit 1
fi

chmod 644 "$temporary"
mv "$temporary" "$target"
echo 'Runtime settings ready.'

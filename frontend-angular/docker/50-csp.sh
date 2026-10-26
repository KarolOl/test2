#!/bin/sh
set -eu

target=/etc/nginx/snippets/runtime-csp.conf
mkdir -p /etc/nginx/snippets
temporary="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT HUP INT TERM

# Parse JSON and allow only validated HTTP(S) origins into nginx configuration.
awk -v csp=1 -f /opt/app/settings.awk /usr/share/nginx/html/settings.json > "$temporary"

chmod 644 "$temporary"
mv "$temporary" "$target"
echo 'Runtime CSP origins ready.'

#!/bin/sh
set -eu

target=/etc/nginx/snippets/runtime-csp.conf
mkdir -p /etc/nginx/snippets
temporary="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT HUP INT TERM

# Only validated HTTP(S) origins can enter nginx configuration, never arbitrary JSON text.
jq -er '
    def http_origin:
        if type != "string" then error("CSP requires a HTTP(S) URL")
        else
            (capture("^(?<origin>https?://(?:\\[[0-9a-fA-F:.]+\\]|[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)(?::[0-9]{1,5})?)(?:/|$)"; "i")
                // error("Cannot derive a safe HTTP(S) origin for CSP"))
            | .origin | ascii_downcase
        end;

    {
        api: (
            .apiBaseUrl
            | if type != "string" then error("CSP requires apiBaseUrl")
              elif startswith("/") and (startswith("//") | not) and (test("[\\\\\\s?#]") | not)
              then ""
              else http_origin
              end
        ),
        keycloak: (.keycloak.url | http_origin)
    }
    | "set $csp_api_origin \"\(.api)\";\nset $csp_keycloak_origin \"\(.keycloak)\";"
' /usr/share/nginx/html/settings.json > "$temporary"

chmod 644 "$temporary"
mv "$temporary" "$target"
echo 'Runtime CSP origins ready.'

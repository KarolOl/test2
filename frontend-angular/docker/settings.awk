# JSON validation and CSP origin extraction using only BusyBox awk.
function fail(message) {
    print "Invalid settings: " message > "/dev/stderr"
    exit 1
}
function space() {
    while (substr(json, pos, 1) ~ /^[ \t\r\n]$/) pos++
}
function hex4(    digits, i, n, c) {
    digits = tolower(substr(json, pos, 4))
    if (length(digits) != 4 || digits ~ /[^0-9a-f]/) fail("invalid Unicode escape")
    n = 0
    for (i = 1; i <= 4; i++) {
        c = index("0123456789abcdef", substr(digits, i, 1)) - 1
        n = n * 16 + c
    }
    pos += 4
    return n
}
function utf8(n) {
    if (n < 128) return sprintf("%c", n)
    if (n < 2048) return sprintf("%c%c", 192 + int(n / 64), 128 + n % 64)
    if (n < 65536) return sprintf("%c%c%c", 224 + int(n / 4096), 128 + int(n / 64) % 64, 128 + n % 64)
    return sprintf("%c%c%c%c", 240 + int(n / 262144), 128 + int(n / 4096) % 64, 128 + int(n / 64) % 64, 128 + n % 64)
}
function string(    result, c, escape, n, low) {
    if (substr(json, pos++, 1) != "\"") fail("expected string")
    result = ""
    while (pos <= length(json)) {
        c = substr(json, pos++, 1)
        if (c == "\"") return result
        if (c ~ /[[:cntrl:]]/) fail("control character in string")
        if (c == "\\") {
            escape = substr(json, pos++, 1)
            if (escape == "u") {
                n = hex4()
                if (n >= 55296 && n <= 56319) {
                    if (substr(json, pos, 2) != "\\u") fail("missing low surrogate")
                    pos += 2
                    low = hex4()
                    if (low < 56320 || low > 57343) fail("invalid low surrogate")
                    n = 65536 + (n - 55296) * 1024 + low - 56320
                } else if (n >= 56320 && n <= 57343) fail("unexpected low surrogate")
                c = utf8(n)
            } else if (escape == "\"" || escape == "\\" || escape == "/") c = escape
            else if (escape == "b") c = sprintf("%c", 8)
            else if (escape == "f") c = sprintf("%c", 12)
            else if (escape == "n") c = "\n"
            else if (escape == "r") c = "\r"
            else if (escape == "t") c = "\t"
            else fail("invalid escape")
        }
        result = result c
    }
    fail("unterminated string")
}
# scope identifies only the two objects whose fields affect CSP.
function value(scope, depth,    c, key, child, token, kind, result) {
    if (depth > 64) fail("JSON nesting exceeds 64 levels")
    space()
    c = substr(json, pos, 1)
    if (c == "{" || c == "[") {
        kind = c == "{" ? "object" : "array"
        pos++
        space()
        if (substr(json, pos, 1) != (c == "{" ? "}" : "]")) {
            while (1) {
                child = ""
                if (c == "{") {
                    space()
                    key = string()
                    space()
                    if (substr(json, pos++, 1) != ":") fail("expected colon")
                    if (scope == "root" && key == "keycloak") {
                        child = "keycloak"
                        keycloak = urlType = ""
                    }
                }
                value(child, depth + 1)
                if (c == "{" && scope == "root" && key == "apiBaseUrl") {
                    api = parsed
                    apiType = parsedType
                }
                if (c == "{" && scope == "root" && key == "keycloak") keycloakType = parsedType
                if (c == "{" && scope == "keycloak" && key == "url") {
                    keycloak = parsed
                    urlType = parsedType
                }
                space()
                token = substr(json, pos, 1)
                if (token != ",") break
                pos++
            }
        }
        if (substr(json, pos++, 1) != (c == "{" ? "}" : "]")) fail("expected closing bracket")
    } else if (c == "\"") {
        kind = "string"
        result = string()
    } else {
        token = substr(json, pos)
        if (match(token, /^(true|false|null)/)) kind = "literal"
        else if (match(token, /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/)) kind = "number"
        else fail("expected JSON value")
        pos += RLENGTH
    }
    parsedType = kind
    parsed = result
}
function origin(url,    lower, authority, host, remainder) {
    lower = tolower(url)
    if (lower !~ /^https?:\/\//) fail("CSP requires HTTP(S) URL")
    authority = lower
    sub(/^https?:\/\//, "", authority)
    sub(/\/.*/, "", authority)
    host = authority
    if (host ~ /^\[/) {
        if (!match(host, /^\[[0-9a-f:.]+\]/)) fail("invalid IPv6 origin")
        remainder = substr(host, RLENGTH + 1)
        host = substr(host, 1, RLENGTH)
    } else {
        sub(/:.*/, "", host)
        remainder = substr(authority, length(host) + 1)
        if (host !~ /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/) fail("invalid host")
    }
    if (remainder != "" && remainder !~ /^:[0-9][0-9]?[0-9]?[0-9]?[0-9]?$/) fail("invalid port")
    return substr(lower, 1, index(lower, "://") + 2) authority
}
{ json = json $0 "\n" }
END {
    # exit from fail() also runs END; parsing happens only here.
    pos = 1
    value("root", 0)
    space()
    if (parsedType != "object" || pos <= length(json)) fail("expected one JSON object")
    if (apiType != "string" || keycloakType != "object" || urlType != "string") fail("apiBaseUrl and keycloak.url must be strings")
    if (substr(api, 1, 1) == "/" && substr(api, 1, 2) != "//" && api !~ /[\\[:space:]?#[:cntrl:]]/) apiOrigin = ""
    else apiOrigin = origin(api)
    keycloakOrigin = origin(keycloak)
    if (csp) {
        printf "set $csp_api_origin \"%s\";\n", apiOrigin
        printf "set $csp_keycloak_origin \"%s\";\n", keycloakOrigin
    }
}

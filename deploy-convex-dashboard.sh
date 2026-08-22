#!/usr/bin/env bash
#
# Deploys the self-hosted Convex dashboard behind Caddy at
# https://dashboard.magicboxai.in — RUN THIS ON THE CONVEX VM (136.107.79.221).
#
# The dashboard is full database read/write. It is therefore published behind
# HTTP basic auth *in addition to* the admin key its own login screen asks for.
# The container itself only ever binds to 127.0.0.1, so the single public path
# in is Caddy, which is where the basic-auth check lives.
#
# Prerequisite (do this first, it cannot be scripted from here): in Vercel →
# Domains → magicboxai.in, add  A  dashboard  136.107.79.221. The zone has a
# wildcard pointing at Vercel; an explicit A record overrides it. Caddy cannot
# issue a certificate until that record resolves here, so this script refuses
# to run before it does.
#
# Usage:  sudo ./deploy-convex-dashboard.sh
#
set -euo pipefail

HOSTNAME_PUBLIC="dashboard.magicboxai.in"
BACKEND_PUBLIC="https://convex.magicboxai.in"
IMAGE="ghcr.io/get-convex/convex-dashboard:latest"
CONTAINER="convex-dashboard"
DASH_PORT="6791"
CADDYFILE="/etc/caddy/Caddyfile"
BASIC_AUTH_USER="magicbox"

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run with sudo."
command -v docker >/dev/null || die "docker is not installed on this host."

# ---------------------------------------------------------------------------
# 1. Preflight: DNS must already point here, or Caddy's TLS challenge fails.
# ---------------------------------------------------------------------------
say "Checking DNS for ${HOSTNAME_PUBLIC}"
MY_IP="$(curl -fsS -m 10 https://api.ipify.org || true)"
DNS_IP="$(getent hosts "$HOSTNAME_PUBLIC" | awk '{print $1}' | head -1 || true)"
[ -n "$DNS_IP" ] || die "${HOSTNAME_PUBLIC} does not resolve yet. Add the A record in Vercel first."
if [ -n "$MY_IP" ] && [ "$DNS_IP" != "$MY_IP" ]; then
  die "${HOSTNAME_PUBLIC} resolves to ${DNS_IP}, but this host is ${MY_IP}.
     That is still the Vercel wildcard. Add  A  dashboard  ${MY_IP}  in Vercel,
     wait for it to propagate, then re-run."
fi
echo "   ${HOSTNAME_PUBLIC} → ${DNS_IP} (this host)"

# ---------------------------------------------------------------------------
# 2. Basic-auth credential.
# ---------------------------------------------------------------------------
say "Setting the basic-auth password for user '${BASIC_AUTH_USER}'"
read -rsp "   Password: " BASIC_AUTH_PASS; echo
[ -n "$BASIC_AUTH_PASS" ] || die "Empty password."

# Caddy renamed the flag and the directive in 2.8; support both generations.
if command -v caddy >/dev/null; then
  HASH="$(caddy hash-password --plaintext "$BASIC_AUTH_PASS" 2>/dev/null \
       || caddy hash-password -plaintext "$BASIC_AUTH_PASS" 2>/dev/null || true)"
else
  HASH="$(docker run --rm caddy:latest caddy hash-password --plaintext "$BASIC_AUTH_PASS" 2>/dev/null || true)"
fi
[ -n "$HASH" ] || die "Could not hash the password — is caddy on PATH, or docker able to pull caddy:latest?"

# ---------------------------------------------------------------------------
# 3. The dashboard container. Bound to loopback only: Caddy is the sole way in.
#    NEXT_PUBLIC_DEPLOYMENT_URL is read by the BROWSER, so it must be the
#    public backend URL, not 127.0.0.1.
# ---------------------------------------------------------------------------
say "Starting ${CONTAINER}"
docker pull "$IMAGE"
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p "127.0.0.1:${DASH_PORT}:6791" \
  -e "NEXT_PUBLIC_DEPLOYMENT_URL=${BACKEND_PUBLIC}" \
  "$IMAGE"

# ---------------------------------------------------------------------------
# 4. Caddy vhost. Caddy may be a systemd unit or a container; the upstream
#    address differs because a container cannot reach the host's loopback.
# ---------------------------------------------------------------------------
CADDY_CONTAINER="$(docker ps --filter ancestor=caddy --format '{{.Names}}' | head -1 || true)"
if [ -n "$CADDY_CONTAINER" ]; then
  say "Caddy is running as container '${CADDY_CONTAINER}'"
  docker network connect "$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$CADDY_CONTAINER")" "$CONTAINER" 2>/dev/null || true
  UPSTREAM="${CONTAINER}:6791"
  CADDYFILE="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$CADDY_CONTAINER")"
  [ -n "$CADDYFILE" ] || die "Caddy runs in a container but its Caddyfile is not bind-mounted — add the vhost by hand."
else
  say "Caddy is running on the host"
  UPSTREAM="127.0.0.1:${DASH_PORT}"
  [ -f "$CADDYFILE" ] || die "No Caddyfile at ${CADDYFILE}."
fi
echo "   Caddyfile: ${CADDYFILE}"
echo "   Upstream:  ${UPSTREAM}"

if grep -q "^${HOSTNAME_PUBLIC}" "$CADDYFILE"; then
  say "Removing the previous ${HOSTNAME_PUBLIC} block"
  cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%s)"
  # Drop the existing site block: from its header to the line closing it.
  awk -v host="$HOSTNAME_PUBLIC" '
    $0 ~ "^"host { skip=1 }
    skip && /^}/  { skip=0; next }
    !skip
  ' "$CADDYFILE" > "${CADDYFILE}.new" && mv "${CADDYFILE}.new" "$CADDYFILE"
else
  cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%s)"
fi

# `basic_auth` is the 2.8+ spelling; `basicauth` is older. Try the new one,
# validate, and fall back rather than guessing at the installed version.
append_vhost() {
  cat >> "$CADDYFILE" <<EOF

${HOSTNAME_PUBLIC} {
	${1} {
		${BASIC_AUTH_USER} ${HASH}
	}
	reverse_proxy ${UPSTREAM}
}
EOF
}

say "Adding the ${HOSTNAME_PUBLIC} vhost"
append_vhost "basic_auth"
if ! caddy validate --config "$CADDYFILE" >/dev/null 2>&1; then
  awk -v host="$HOSTNAME_PUBLIC" '$0 ~ "^"host {skip=1} skip && /^}/ {skip=0; next} !skip' \
    "$CADDYFILE" > "${CADDYFILE}.new" && mv "${CADDYFILE}.new" "$CADDYFILE"
  append_vhost "basicauth"
  caddy validate --config "$CADDYFILE" >/dev/null 2>&1 \
    || die "Caddyfile does not validate. Restored copies are at ${CADDYFILE}.bak.*"
fi

say "Reloading Caddy"
if [ -n "$CADDY_CONTAINER" ]; then
  docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile
else
  systemctl reload caddy || caddy reload --config "$CADDYFILE"
fi

# ---------------------------------------------------------------------------
# 5. Verify. The first request also triggers certificate issuance.
# ---------------------------------------------------------------------------
say "Verifying (first hit issues the certificate, so allow a few seconds)"
for i in $(seq 1 12); do
  CODE="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://${HOSTNAME_PUBLIC}/" || true)"
  [ "$CODE" = "401" ] && { echo "   401 — Caddy is up and basic auth is enforced."; break; }
  [ "$CODE" = "200" ] && { echo "   200 — up, but basic auth is NOT challenging. Check the vhost."; break; }
  sleep 5
done

cat <<EOF

$(printf '\033[1;32m✔ Done\033[0m')

  URL       https://${HOSTNAME_PUBLIC}
  Login 1   basic auth — ${BASIC_AUTH_USER} / the password you just set
  Login 2   the dashboard asks for the deployment admin key: it is
            CONVEX_SELF_HOSTED_ADMIN_KEY in packages/backend/.env.local

  Logs      docker logs -f ${CONTAINER}
  Stop      docker rm -f ${CONTAINER}

  This URL grants full read/write on the production database. Rotate the
  basic-auth password if it is ever shared.
EOF

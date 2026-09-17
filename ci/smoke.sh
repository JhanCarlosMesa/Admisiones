#!/bin/sh
###############################################################################
# ci/smoke.sh
# ----------------------------------------------------------------------------
# Smoke test POSIX sh (compatible con curlimages/curl que no tiene bash).
###############################################################################
set -u

if [ -z "${APP_URL:-}" ]; then
  echo "ERROR: APP_URL no está definida (¿se cargó deploy.env?)"
  exit 2
fi

MAX_ATTEMPTS=30
SLEEP_SECONDS=10

echo "Smoke test contra: $APP_URL"

i=1
while [ "$i" -le "$MAX_ATTEMPTS" ]; do
  if curl -fsSL --max-time 10 "$APP_URL" 2>/dev/null | grep -q "Admisiones UNAC"; then
    echo "OK: la app responde correctamente (intento $i)"
    exit 0
  fi
  echo "Intento $i/$MAX_ATTEMPTS: la app aún no responde como se espera, esperando ${SLEEP_SECONDS}s..."
  i=$((i + 1))
  sleep "$SLEEP_SECONDS"
done

echo "ERROR: la app no respondió correctamente tras $((MAX_ATTEMPTS * SLEEP_SECONDS)) segundos."
exit 1

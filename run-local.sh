#!/usr/bin/env bash
# Levanta el visor en esta máquina usando solo "docker" (no hace falta docker compose).
#   ./run-local.sh            -> construye, hace la carga inicial (si el volumen está vacío) y arranca en http://localhost:8000
#   PORT=8080 ./run-local.sh  -> otro puerto
#   ./run-local.sh stop       -> detiene y quita el contenedor (los datos quedan en el volumen)
set -euo pipefail
cd "$(dirname "$0")"

NAME=${NAME:-visor-isi}
PORT=${PORT:-8000}
VOL=${VOL:-visor_isi_data}
ENV_FILE=.local.env

if [ "${1:-}" = "stop" ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 && echo "Detenido: $NAME (datos conservados en el volumen $VOL)"
  exit 0
fi

# Credenciales locales: se generan una vez y se reutilizan
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  {
    echo "ADMIN_PASSWORD=$(python3 -c 'import secrets;print(secrets.token_urlsafe(12))')"
    echo "SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
  } > "$ENV_FILE"
fi
# shellcheck disable=SC1090
. "./$ENV_FILE"

echo "==> Construyendo la imagen…"
docker build -q -t visor-isi:local .

if ! docker volume inspect "$VOL" >/dev/null 2>&1; then
  echo "==> Carga inicial de los documentos y PDFs (una sola vez)…"
  docker volume create "$VOL" >/dev/null
  docker run --rm -v "$VOL":/data -v "$PWD/frontend/public":/seed:ro visor-isi:local \
    python seed.py --docs /seed/data/docs.json --pdf-dir /seed/pdfs --data-dir /data --convenios /seed/data/convenios.json --convenio-pdf-dir /seed/pdfs/convenios
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped -p "127.0.0.1:$PORT:8000" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" -e SECRET_KEY="$SECRET_KEY" -v "$VOL":/data visor-isi:local >/dev/null

echo
echo "Listo:  http://localhost:$PORT"
echo "Administrador (para subir documentos): contraseña guardada en $(pwd)/$ENV_FILE"
echo "Detener:  ./run-local.sh stop"

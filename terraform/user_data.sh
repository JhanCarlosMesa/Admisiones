#!/bin/bash
###############################################################################
# user_data.sh
# ----------------------------------------------------------------------------
# Robusto: instala AWS CLI si no está, espera archivos en S3, sincroniza al
# web root de Nginx y reinicia Nginx.
###############################################################################
exec > /var/log/user-data.log 2>&1

BUCKET_NAME="${bucket_name}"
REGION="${region}"
WEB_ROOT="/var/www/html"  # Ubuntu nginx default, ver packer.pkr.hcl:233

DEBUG_LOG="$WEB_ROOT/_debug.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$DEBUG_LOG"; }

# Prepara el debug log lo antes posible (escribimos aunque falten permisos)
mkdir -p "$WEB_ROOT"
: > "$DEBUG_LOG"

log "=== user_data INICIO ==="
log "BUCKET_NAME=$BUCKET_NAME"
log "REGION=$REGION"
log "WEB_ROOT=$WEB_ROOT"

# ----------------------------------------------------------------------------
# 0) Asegurar AWS CLI (el AMI no la incluye y el paquete apt 'awscli' no existe
#    en Ubuntu 24.04). Instalamos la v2 oficial.
# ----------------------------------------------------------------------------
if ! command -v aws >/dev/null 2>&1; then
  log "AWS CLI no encontrada. Instalando AWS CLI v2..."
  apt-get update -y >> "$DEBUG_LOG" 2>&1
  apt-get install -y curl unzip >> "$DEBUG_LOG" 2>&1
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
    -o /tmp/awscliv2.zip >> "$DEBUG_LOG" 2>&1
  unzip -q -o /tmp/awscliv2.zip -d /tmp/ >> "$DEBUG_LOG" 2>&1
  /tmp/aws/install >> "$DEBUG_LOG" 2>&1
  rm -rf /tmp/awscliv2.zip /tmp/aws
  log "AWS CLI instalada: $(aws --version 2>&1)"
else
  log "AWS CLI ya presente: $(aws --version 2>&1)"
fi

# ----------------------------------------------------------------------------
# 1) Esperar a que la pipeline suba archivos al bucket
# ----------------------------------------------------------------------------
log "Esperando archivos en s3://$BUCKET_NAME/ ..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
  COUNT=$(aws s3 ls "s3://$BUCKET_NAME/" --region "$REGION" --no-sign-request 2>/dev/null | wc -l)
  log "Intento $ATTEMPT: $COUNT archivos en bucket"
  if [ "$COUNT" -gt 0 ]; then
    log "Archivos detectados, continuando"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 10
done

if [ "$ATTEMPT" -eq "$MAX_ATTEMPTS" ]; then
  log "ADVERTENCIA: timeout esperando archivos en S3"
fi

# ----------------------------------------------------------------------------
# 2) Sincronizar bucket -> web root
# ----------------------------------------------------------------------------
log "Sincronizando s3://$BUCKET_NAME/ -> $WEB_ROOT/"
aws s3 sync "s3://$BUCKET_NAME/" "$WEB_ROOT/" \
  --region "$REGION" --no-sign-request --delete >> "$DEBUG_LOG" 2>&1
SYNC_EXIT=$?
log "SYNC_EXIT=$SYNC_EXIT"

# ----------------------------------------------------------------------------
# 3) Reiniciar Nginx
# ----------------------------------------------------------------------------
log "Reiniciando Nginx..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable nginx 2>>"$DEBUG_LOG"
  systemctl restart nginx 2>>"$DEBUG_LOG" || service nginx restart 2>>"$DEBUG_LOG"
else
  service nginx restart 2>>"$DEBUG_LOG"
fi
NGINX_STATUS=$(systemctl is-active nginx 2>/dev/null || echo unknown)
log "NGINX_STATUS=$NGINX_STATUS"

log "=== user_data FIN ==="

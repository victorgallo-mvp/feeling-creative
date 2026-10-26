#!/usr/bin/env bash
# Ambiente local de testes (antes de commitar): sobe API (:3001) + front (:5173)
# acessíveis também pelo celular na mesma rede Wi-Fi, com dados de exemplo.
#
#   npm run dev:local
#
# - Descobre o IP da máquina e configura API_URL / FRONTEND_URL / VITE_API_URL com ele,
#   assim o link de aprovação gerado abre no celular e os arquivos carregam.
# - Roda migrations e seed (idempotente; cria admin + exemplos só se ainda não existirem).
# - Não altera os arquivos .env.
set -euo pipefail
cd "$(dirname "$0")/.."

IP="${DEV_IP:-}"
if [ -z "$IP" ]; then
  for IFACE in en0 en1 en2; do
    IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
    [ -n "$IP" ] && break
  done
fi
if [ -z "$IP" ]; then IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true); fi
IP="${IP:-localhost}"

export API_URL="http://$IP:3001"
export FRONTEND_URL="http://$IP:5173"
export VITE_API_URL="http://$IP:3001"
export SEED_EXAMPLES="${SEED_EXAMPLES:-true}"

echo "▶ migrations"; npm run migrate -w server --silent
echo "▶ seed";       npm run seed -w server --silent
echo
echo "  Painel (computador):  http://localhost:5173/login"
echo "  Painel (celular):     http://$IP:5173/login"
echo "  Login: admin@feeling.com.br / feeling123"
echo "  Links de aprovação gerados agora apontam para http://$IP:5173/a/... (abrem no celular)"
echo

exec npx concurrently -k -n api,web -c blue,green "npm run dev -w server" "npm run dev -w web -- --host"

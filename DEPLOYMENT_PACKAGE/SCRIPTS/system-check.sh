#!/bin/bash
# =============================================================================
# KUCET CMS: Institutional System & Network Health Check
# Checks Docker containers, resource utilization, network ports, Tailscale,
# and server power management invariants.
# =============================================================================

echo "============================================================"
echo "   KUCET CMS: INSTITUTIONAL SYSTEM & NETWORK HEALTH CHECK   "
echo "   Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "============================================================"

echo -e "\n1. DOCKER CONTAINER STATUS:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n2. RESOURCE USAGE:"
echo "--- DISK ---"
df -h | grep -E '^/dev/|Filesystem'
echo "--- RAM ---"
free -h

echo -e "\n3. LOCAL NETWORK LISTENING PORTS:"
netstat -tuln 2>/dev/null | grep -E '(:80|:443|:3000|:3001|:3306|:6379)' || ss -tuln | grep -E '(:80|:443|:3000|:3001|:3306|:6379)'

echo -e "\n4. TAILSCALE STATUS & SERVE MAPPING:"
if command -v tailscale >/dev/null 2>&1; then
  echo "--- Tailscale Node ---"
  tailscale ip -4 2>/dev/null || echo "Tailscale IP not available"
  echo "--- Tailscale Serve Status ---"
  tailscale serve status 2>/dev/null || echo "No active Tailscale Serve config"
  echo "--- Tailscale Netcheck Summary ---"
  tailscale netcheck 2>/dev/null | grep -E '(UDP|IPv4|Nearest DERP)' || true
else
  echo "Tailscale CLI not found in PATH."
fi

echo -e "\n5. SERVER SLEEP & POWER MANAGEMENT STATUS:"
if command -v systemctl >/dev/null 2>&1; then
  for target in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
    status=$(systemctl is-enabled "$target" 2>/dev/null || echo "unknown")
    echo "  $target : $status (should be 'masked' for 24/7 server)"
  done
else
  echo "systemctl not available."
fi

echo -e "\n6. RECENT APP LOGS (Last 10 lines):"
docker logs kucet-cms-app --tail 10 2>&1 || echo "App logs unavailable"

echo -e "\n============================================================"

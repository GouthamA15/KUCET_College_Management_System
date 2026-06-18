#!/bin/bash
# KUCET CMS: System Health Check

echo "=========================================="
echo "   KUCET CMS: INSTITUTIONAL HEALTH CHECK  "
echo "   Time: $(date)"
echo "=========================================="

echo -e "\n1. CONTAINER STATUS:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n2. RESOURCE USAGE:"
echo "--- DISK ---"
df -h | grep '^/dev/'
echo "--- RAM ---"
free -h

echo -e "\n3. NETWORK PORTS:"
netstat -tuln | grep -E '(:80|:443|:3306|:6379)'

echo -e "\n4. RECENT APP LOGS (Last 5 lines):"
docker logs kucet-cms-app --tail 5

echo -e "\n=========================================="

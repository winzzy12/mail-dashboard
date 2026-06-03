#!/bin/bash
# Mail Dashboard - Quick Access Commands

echo "════════════════════════════════════════════"
echo "📧 JUSTBLURRY MAIL - QUICK ACCESS"
echo "════════════════════════════════════════════"
echo ""

echo "🌐 WEB INTERFACE:"
echo "   https://justblurry-mail.wirasaputra3005.workers.dev"
echo ""

echo "📡 API ENDPOINTS:"
echo "   Webhook:     /api/webhook (POST)"
echo "   Get Emails:  /api/emails (GET)"
echo "   Email Count: /api/emails/count (GET)"
echo "   Health:      /api/test (GET)"
echo ""

echo "📊 QUICK STATS:"
curl -s https://justblurry-mail.wirasaputra3005.workers.dev/api/emails/count | python3 -c "import sys,json; print(f'   Total Emails: {json.load(sys.stdin)[\"total\"]}')"
echo ""

echo "📧 LAST 5 EMAILS:"
curl -s 'https://justblurry-mail.wirasaputra3005.workers.dev/api/emails?limit=5' | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data['emails']:
    print(f\"   [{e['id']}] {e['subject'][:40]} | To: {e['to_address']}\")
"
echo ""

echo "════════════════════════════════════════════"
echo "📝 COMMANDS:"
echo "════════════════════════════════════════════"
echo ""
echo "# Open web interface"
echo "xdg-open https://justblurry-mail.wirasaputra3005.workers.dev"
echo ""
echo "# Get all emails"
echo "curl https://justblurry-mail.wirasaputra3005.workers.dev/api/emails"
echo ""
echo "# Get email count"
echo "curl https://justblurry-mail.wirasaputra3005.workers.dev/api/emails/count"
echo ""
echo "# Send test email"
echo "echo 'Test' | mail -s 'Test' test@yourdomain.com"
echo ""
echo "# Check forwarder logs"
echo "ssh root@64.226.100.60 'tail -f /var/log/cloudmail-forwarder.log'"
echo ""
echo "# Redeploy worker"
echo "cd /root/justblurry-mail && wrangler deploy"
echo ""
echo "════════════════════════════════════════════"

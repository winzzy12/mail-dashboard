#!/bin/bash
# Justblurry Mail - Mail Server Installation Script
# Run this on your mail server (64.226.100.60 or your mail server IP)

set -e

echo "======================================"
echo "Justblurry Mail - Mail Server Setup"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root"
  exit 1
fi

# Prompt for Worker URL
read -p "Enter your Cloudflare Worker URL (e.g., https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev): " WORKER_URL

if [ -z "$WORKER_URL" ]; then
  echo "❌ Worker URL is required"
  exit 1
fi

echo ""
echo "📦 Installing dependencies..."
apt-get update -qq
apt-get install -y python3 python3-pip postfix mailutils > /dev/null 2>&1
pip3 install requests -q

echo ""
echo "📧 Creating email forwarder script..."

cat > /usr/local/bin/postfix_to_cloudmail.py << EOF
#!/usr/bin/env python3
import sys
import email
import json
import requests
import logging
from email.parser import Parser

# Setup logging
logging.basicConfig(
    filename='/var/log/cloudmail-forwarder.log',
    level=logging.INFO,
    format='[%(asctime)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Cloudflare Worker webhook URL
CLOUDMAIL_WEBHOOK_URL = "${WORKER_URL}/api/webhook"

def forward_to_cloudmail():
    try:
        # Read email from stdin
        raw_email = sys.stdin.read()
        msg = Parser().parsestr(raw_email)
        
        # Extract email data
        payload = {
            "from": msg.get("From", ""),
            "to": msg.get("To", ""),
            "subject": msg.get("Subject", ""),
            "message_id": msg.get("Message-ID", ""),
            "date": msg.get("Date", ""),
            "text_body": "",
            "html_body": ""
        }
        
        # Extract body
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload["text_body"] = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                elif content_type == "text/html":
                    payload["html_body"] = part.get_payload(decode=True).decode("utf-8", errors="ignore")
        else:
            payload["text_body"] = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
        
        # Forward to webhook
        response = requests.post(CLOUDMAIL_WEBHOOK_URL, json=payload, timeout=10)
        
        if response.status_code == 200:
            logging.info(f"✓ Forwarded: {payload['subject']} to {payload['to']}")
            return 0
        else:
            logging.error(f"✗ Failed: HTTP {response.status_code}")
            return 1
            
    except Exception as e:
        logging.error(f"✗ Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(forward_to_cloudmail())
EOF

chmod +x /usr/local/bin/postfix_to_cloudmail.py

echo ""
echo "⚙️  Configuring Postfix..."

# Backup existing configs
cp /etc/postfix/main.cf /etc/postfix/main.cf.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/postfix/master.cf /etc/postfix/master.cf.backup.$(date +%Y%m%d_%H%M%S)

# Create transport map
echo "justblurry.com cloudmail:" > /etc/postfix/transport
postmap /etc/postfix/transport

# Configure Postfix main.cf
postconf -e 'transport_maps = hash:/etc/postfix/transport'
postconf -e 'cloudmail_destination_recipient_limit = 1'

# Update mydestination (remove justblurry.com if present)
postconf -e 'mydestination = $myhostname, mail.justblurry.com, localhost.com, localhost'

# Disable virtual alias for justblurry.com
echo "# Virtual aliases disabled for Justblurry Mail" > /etc/postfix/virtual
postmap /etc/postfix/virtual

# Check if cloudmail entry exists in master.cf
if ! grep -q "^cloudmail unix" /etc/postfix/master.cf; then
  echo "" >> /etc/postfix/master.cf
  echo "# Justblurry Mail forwarder" >> /etc/postfix/master.cf
  echo "cloudmail unix - n n - - pipe" >> /etc/postfix/master.cf
  echo "  flags=F user=nobody argv=/usr/local/bin/postfix_to_cloudmail.py" >> /etc/postfix/master.cf
fi

# Create log file
touch /var/log/cloudmail-forwarder.log
chmod 644 /var/log/cloudmail-forwarder.log

echo ""
echo "🔄 Reloading Postfix..."
postfix reload

echo ""
echo "✅ Installation complete!"
echo ""
echo "======================================"
echo "📧 Test Email Delivery"
echo "======================================"
echo ""
echo "Send test email:"
echo "  echo 'Test email body' | mail -s 'Test Subject' test@justblurry.com"
echo ""
echo "View logs:"
echo "  tail -f /var/log/cloudmail-forwarder.log"
echo ""
echo "Check Postfix logs:"
echo "  tail -f /var/log/mail.log"
echo ""
echo "======================================"
echo "🎉 Justblurry Mail is ready!"
echo "======================================"

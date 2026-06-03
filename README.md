# 📧 Justblurry Mail - Email Management System

Modern email management system built with Cloudflare Workers + D1 Database for @justblurry.com domain.

![Status](https://img.shields.io/badge/status-production-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange)

---

## ✨ Features

- 🔐 **Secure Authentication** - Password-protected login
- 📬 **Email Inbox** - Modern dark-themed interface
- 📧 **HTML Email Support** - Full HTML rendering in sandboxed iframe
- 👁️ **Read/Unread Tracking** - Visual indicators for unread emails
- 🗑️ **Delete Emails** - Permanent email deletion
- 🔑 **Password Management** - Change password feature
- 📊 **Stats Dashboard** - Total, Unread, Today counts
- ⚡ **Real-time Updates** - Auto-refresh every 30 seconds
- 🎨 **Modern UI** - Dark theme with gradient accents

---

## 🏗️ Architecture

```
External Email Sender
    ↓
Postfix Mail Server (64.226.100.60)
    ↓
postfix_to_cloudmail.py (Forwarder)
    ↓
Cloudflare Worker (API + Web Interface)
    ↓
D1 Database (SQLite in Cloudflare)
    ↓
Web Dashboard
```

---

## 🚀 Quick Start

### Prerequisites

- Cloudflare account with Workers enabled
- Domain configured (@justblurry.com)
- Mail server with Postfix installed
- Node.js 18+ (for development)

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/winzzy12/mail-dashboard.git
cd mail-dashboard
```

#### 2. Install Dependencies

```bash
npm install -g wrangler
wrangler login
```

#### 3. Create D1 Database

```bash
wrangler d1 create justblurry-mail-db
```

Copy the `database_id` from output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "justblurry-mail-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

#### 4. Initialize Database Schema

```bash
wrangler d1 execute justblurry-mail-db --remote --file=./schema.sql
```

#### 5. Set Default Admin Password

```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE users SET password_hash = 'sha256:wanz2026' WHERE email = 'admin@justblurry.com'"
```

#### 6. Deploy Worker

```bash
wrangler deploy
```

Your app is now live at: `https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev`

---

## 📮 Mail Server Setup

### Install Forwarder Script on Mail Server

SSH to your mail server and create the forwarder script:

```bash
ssh root@YOUR_MAIL_SERVER

# Create forwarder script
cat > /usr/local/bin/postfix_to_cloudmail.py << 'EOF'
#!/usr/bin/env python3
import sys
import email
import json
import requests
from email.parser import Parser

# Cloudflare Worker webhook URL
CLOUDMAIL_WEBHOOK_URL = "https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev/api/webhook"

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
            print(f"✓ Forwarded: {payload['subject']} to {payload['to']}")
            return 0
        else:
            print(f"✗ Failed: HTTP {response.status_code}")
            return 1
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(forward_to_cloudmail())
EOF

chmod +x /usr/local/bin/postfix_to_cloudmail.py
```

### Configure Postfix Transport

```bash
# Add transport map
echo "justblurry.com cloudmail:" > /etc/postfix/transport
postmap /etc/postfix/transport

# Configure Postfix
postconf -e 'transport_maps = hash:/etc/postfix/transport'
postconf -e 'cloudmail_destination_recipient_limit = 1'

# Add master.cf entry
cat >> /etc/postfix/master.cf << 'EOF'
cloudmail unix - n n - - pipe
  flags=F user=nobody argv=/usr/local/bin/postfix_to_cloudmail.py
EOF

# Remove virtual alias if exists
echo "# Virtual aliases disabled for Justblurry Mail" > /etc/postfix/virtual
postmap /etc/postfix/virtual

# Update mydestination (remove justblurry.com if present)
postconf -e 'mydestination = $myhostname, mail.justblurry.com, localhost.com, localhost'

# Reload Postfix
postfix reload
```

### Setup Logging

```bash
# Create log file
touch /var/log/cloudmail-forwarder.log
chmod 644 /var/log/cloudmail-forwarder.log

# Update script to log
sed -i 's|print(|import logging; logging.basicConfig(filename="/var/log/cloudmail-forwarder.log"); logging.info(|g' \
  /usr/local/bin/postfix_to_cloudmail.py
```

### Test Email Delivery

```bash
echo "Test email body" | mail -s "Test Subject" test@justblurry.com
tail -f /var/log/cloudmail-forwarder.log
```

---

## 🔐 Default Credentials

**Web Interface:** `https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev`

- **Email:** admin@justblurry.com
- **Password:** wanz2026

⚠️ **Change password immediately after first login!**

---

## 📖 Usage

### Login

1. Navigate to your deployed worker URL
2. Enter credentials
3. Click "Sign In"

### View Emails

- **Inbox** shows all emails (newest first)
- **Unread emails** have blue dot + highlight
- **Click email** to view full content
- **HTML/Text toggle** to switch views

### Delete Email

1. Open email (modal)
2. Click 🗑️ trash icon
3. Confirm deletion
4. Email permanently deleted

### Change Password

1. Click "Change Password" in sidebar
2. Enter current password
3. Enter new password (min 6 chars)
4. Confirm new password
5. Click "Update Password"

---

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Run local dev server
wrangler dev

# Tail live logs
wrangler tail
```

### Database Operations

```bash
# List all emails
wrangler d1 execute justblurry-mail-db --remote \
  --command "SELECT * FROM emails ORDER BY received_at DESC LIMIT 10"

# Count emails
wrangler d1 execute justblurry-mail-db --remote \
  --command "SELECT COUNT(*) as total FROM emails"

# Mark all as read
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE emails SET is_read = 1"

# Delete old emails (30+ days)
wrangler d1 execute justblurry-mail-db --remote \
  --command "DELETE FROM emails WHERE received_at < strftime('%s', 'now', '-30 days')"

# Reset admin password
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE users SET password_hash = 'sha256:newpassword' WHERE email = 'admin@justblurry.com'"
```

### Deploy Updates

```bash
wrangler deploy
```

---

## 📊 Database Schema

### `emails` Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| message_id | TEXT | Unique message ID |
| from_address | TEXT | Sender email |
| to_address | TEXT | Recipient email |
| subject | TEXT | Email subject |
| text_body | TEXT | Plain text content |
| html_body | TEXT | HTML content |
| received_at | INTEGER | Unix timestamp |
| is_read | INTEGER | 0=unread, 1=read |

### `users` Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| email | TEXT | User email (unique) |
| password_hash | TEXT | Password hash |
| full_name | TEXT | Display name |
| created_at | INTEGER | Unix timestamp |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User authentication |
| POST | `/api/change-password` | Update password |
| POST | `/api/webhook` | Receive emails from Postfix |
| GET | `/api/emails` | List emails (paginated) |
| GET | `/api/emails/:id` | Get single email |
| POST | `/api/emails/:id/read` | Mark as read |
| DELETE | `/api/emails/:id` | Delete email |
| GET | `/api/emails/count` | Get total count |

---

## 🎨 Tech Stack

- **Frontend:** Vanilla JavaScript (no framework)
- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **Mail Server:** Postfix + Python forwarder
- **Deployment:** Wrangler CLI

---

## 📁 Project Structure

```
mail-dashboard/
├── src/
│   └── index.ts              # Main worker code
├── schema.sql                # Database schema
├── wrangler.toml             # Cloudflare config
├── package.json              # Dependencies
├── README.md                 # This file
├── DEPLOYMENT_SUCCESS.md     # Deployment guide
└── quick-access.sh           # Helper script
```

---

## 🔧 Troubleshooting

### Email not appearing in inbox

1. Check mail server logs:
   ```bash
   ssh root@YOUR_MAIL_SERVER
   tail -f /var/log/cloudmail-forwarder.log
   tail -f /var/log/mail.log
   ```

2. Test webhook manually:
   ```bash
   curl -X POST https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev/api/webhook \
     -H "Content-Type: application/json" \
     -d '{"from":"test@example.com","to":"admin@justblurry.com","subject":"Test","text_body":"Body","date":"Mon, 3 Jun 2026 10:00:00 +0000","message_id":"<test@example.com>"}'
   ```

3. Check email count:
   ```bash
   curl https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev/api/emails/count
   ```

### Cannot login

1. Verify password in database:
   ```bash
   wrangler d1 execute justblurry-mail-db --remote \
     --command "SELECT email, password_hash FROM users"
   ```

2. Reset password if needed:
   ```bash
   wrangler d1 execute justblurry-mail-db --remote \
     --command "UPDATE users SET password_hash = 'sha256:wanz2026' WHERE email = 'admin@justblurry.com'"
   ```

### Worker deployment fails

1. Check wrangler authentication:
   ```bash
   wrangler whoami
   ```

2. Re-login if needed:
   ```bash
   wrangler logout
   wrangler login
   ```

---

## 📝 License

MIT License - Feel free to use and modify

---

## 🤝 Contributing

Pull requests welcome! For major changes, please open an issue first.

---

## 📧 Support

For issues or questions, open a GitHub issue or contact the maintainer.

---

## 🎯 Roadmap

- [ ] Multi-user support
- [ ] Email folders (Sent, Starred, Trash)
- [ ] Search functionality
- [ ] Email composition (Send emails)
- [ ] Attachments support
- [ ] Mobile app
- [ ] Email filters/rules
- [ ] Two-factor authentication

---

**Built with ❤️ using Cloudflare Workers**

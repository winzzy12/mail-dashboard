# 🚀 Justblurry Mail - Complete Installation Guide

Step-by-step guide to deploy Justblurry Mail from scratch.

---

## 📋 Prerequisites

### Required

- **Cloudflare Account** - Free tier is sufficient
- **Domain** - Registered domain (@justblurry.com or your domain)
- **Mail Server** - VPS with Postfix installed (Ubuntu/Debian)
- **Git** - Installed locally
- **Node.js 18+** - For Wrangler CLI

### Recommended

- Basic command line knowledge
- SSH access to mail server
- GitHub account (for version control)

---

## 🎯 Installation Steps

### Part 1: Cloudflare Worker Setup

#### 1. Clone Repository

```bash
git clone https://github.com/winzzy12/mail-dashboard.git
cd mail-dashboard
```

#### 2. Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This opens browser for authentication. Login with your Cloudflare account.

#### 3. Create D1 Database

```bash
wrangler d1 create justblurry-mail-db
```

**Output example:**
```
✅ Successfully created DB 'justblurry-mail-db'!

[[d1_databases]]
binding = "DB"
database_name = "justblurry-mail-db"
database_id = "fd3c2937-b48c-4e37-aa18-c898786d1a0c"
```

#### 4. Update Configuration

Edit `wrangler.toml` and replace `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "justblurry-mail-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Replace with your database_id
```

#### 5. Initialize Database

```bash
# Run schema to create tables
wrangler d1 execute justblurry-mail-db --remote --file=./schema.sql
```

**Expected output:**
```
🌀 Executing on remote database justblurry-mail-db:
🚣 Executed 7 commands in 0.25ms
```

#### 6. Set Admin Password

```bash
# Set default password: wanz2026
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE users SET password_hash = 'sha256:wanz2026' WHERE email = 'admin@justblurry.com'"
```

**Expected output:**
```
🌀 Executing on remote database justblurry-mail-db:
🚣 Executed 1 command in 0.20ms
  changes: 1
```

#### 7. Deploy Worker

```bash
wrangler deploy
```

**Expected output:**
```
Total Upload: 47.56 KiB / gzip: 8.64 KiB
Uploaded justblurry-mail (5.36 sec)
Deployed justblurry-mail triggers (2.45 sec)
  https://justblurry-mail.wirasaputra3005.workers.dev
Current Version ID: 771fddd1-c13d-4688-bb96-2352667db456
```

✅ **Worker is now live!**

#### 8. Test Web Interface

Open browser and navigate to your worker URL:
```
https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev
```

**Login credentials:**
- Email: `admin@justblurry.com`
- Password: `wanz2026`

---

### Part 2: Mail Server Setup

#### 1. Connect to Mail Server

```bash
ssh root@YOUR_MAIL_SERVER_IP
```

#### 2. Download Installation Script

```bash
curl -o install-mailserver.sh https://raw.githubusercontent.com/winzzy12/mail-dashboard/main/install-mailserver.sh
chmod +x install-mailserver.sh
```

#### 3. Run Installation

```bash
./install-mailserver.sh
```

**It will prompt:**
```
Enter your Cloudflare Worker URL (e.g., https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev):
```

Enter your worker URL and press Enter.

**Expected output:**
```
======================================
Justblurry Mail - Mail Server Setup
======================================

📦 Installing dependencies...
📧 Creating email forwarder script...
⚙️  Configuring Postfix...
🔄 Reloading Postfix...
✅ Installation complete!
```

#### 4. Test Email Delivery

```bash
# Send test email
echo "Test email body" | mail -s "Test Subject" test@justblurry.com

# Wait 2-3 seconds, then check logs
tail -f /var/log/cloudmail-forwarder.log
```

**Expected log:**
```
[2026-06-03 18:45:12] ✓ Forwarded: Test Subject to test@justblurry.com
```

#### 5. Verify Email in Dashboard

1. Open web interface
2. Login with credentials
3. Check inbox - test email should appear

✅ **Email delivery working!**

---

## 🔧 Post-Installation

### Change Admin Password

1. Login to dashboard
2. Click **"Change Password"** in sidebar
3. Enter:
   - Current Password: `wanz2026`
   - New Password: (your secure password)
   - Confirm New Password: (same)
4. Click **"Update Password"**

✅ **Password changed!**

### Configure DNS (Optional)

If you want custom subdomain like `mail.justblurry.com`:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click your worker → Settings → Triggers
3. Add Custom Domain: `mail.justblurry.com`
4. Wait for DNS propagation (1-5 minutes)

### Setup Logrotate (Optional)

To prevent log files from growing too large:

```bash
cat > /etc/logrotate.d/cloudmail << 'EOF'
/var/log/cloudmail-forwarder.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

---

## ✅ Verification Checklist

- [ ] Worker deployed and accessible
- [ ] Login works with admin credentials
- [ ] Test email sent from mail server
- [ ] Email appears in dashboard inbox
- [ ] Email can be opened and read
- [ ] HTML emails render correctly
- [ ] Email can be deleted
- [ ] Password can be changed
- [ ] Unread indicator works

---

## 🐛 Troubleshooting

### Issue: Worker deployment fails

**Solution:**
```bash
# Check authentication
wrangler whoami

# Re-login if needed
wrangler logout
wrangler login

# Try deploy again
wrangler deploy
```

### Issue: Email not appearing in inbox

**Check 1: Mail server logs**
```bash
ssh root@YOUR_MAIL_SERVER
tail -50 /var/log/cloudmail-forwarder.log
tail -50 /var/log/mail.log | grep justblurry
```

**Check 2: Test webhook manually**
```bash
curl -X POST https://justblurry-mail.YOUR_SUBDOMAIN.workers.dev/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": "admin@justblurry.com",
    "subject": "Manual Test",
    "text_body": "Testing webhook",
    "date": "Tue, 03 Jun 2026 10:00:00 +0000",
    "message_id": "<test123@example.com>"
  }'
```

**Check 3: Verify database**
```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "SELECT COUNT(*) FROM emails"
```

### Issue: Cannot login

**Solution: Reset password**
```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE users SET password_hash = 'sha256:wanz2026' WHERE email = 'admin@justblurry.com'"
```

### Issue: Postfix not forwarding emails

**Check transport map:**
```bash
ssh root@YOUR_MAIL_SERVER
postconf transport_maps
cat /etc/postfix/transport
```

**Should output:**
```
transport_maps = hash:/etc/postfix/transport
justblurry.com cloudmail:
```

**Rebuild and reload:**
```bash
postmap /etc/postfix/transport
postfix reload
```

---

## 📊 Database Management

### View All Emails

```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "SELECT id, from_address, subject, is_read FROM emails ORDER BY received_at DESC LIMIT 20"
```

### Count Emails

```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "SELECT COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM emails"
```

### Delete Old Emails (30+ days)

```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "DELETE FROM emails WHERE received_at < strftime('%s', 'now', '-30 days')"
```

### Mark All as Read

```bash
wrangler d1 execute justblurry-mail-db --remote \
  --command "UPDATE emails SET is_read = 1"
```

### Backup Database

```bash
# Export to SQL
wrangler d1 export justblurry-mail-db --remote --output=backup-$(date +%Y%m%d).sql
```

---

## 🔄 Updates & Maintenance

### Deploy Code Updates

```bash
cd mail-dashboard
git pull origin main
wrangler deploy
```

### Update Mail Server Script

```bash
ssh root@YOUR_MAIL_SERVER
curl -o /usr/local/bin/postfix_to_cloudmail.py \
  https://raw.githubusercontent.com/winzzy12/mail-dashboard/main/scripts/postfix_to_cloudmail.py
chmod +x /usr/local/bin/postfix_to_cloudmail.py
```

### Monitor Logs

```bash
# Worker logs (live)
wrangler tail

# Mail server logs
ssh root@YOUR_MAIL_SERVER "tail -f /var/log/cloudmail-forwarder.log"
```

---

## 📈 Performance & Limits

### Cloudflare Workers Limits (Free Tier)

- **Requests:** 100,000/day
- **CPU Time:** 10ms per request
- **Worker Size:** 1MB compressed
- **D1 Database:** 5GB storage, 5M reads/day, 100K writes/day

### Recommended

For high-volume email (100+ emails/day), consider:
- Cloudflare Workers Paid plan ($5/month)
- Increase D1 limits if needed

---

## 🔐 Security Best Practices

1. **Change default password immediately**
2. **Use HTTPS only** (Cloudflare Workers enforce this)
3. **Limit mail server SSH access** (use SSH keys, disable password auth)
4. **Regular backups** (database exports weekly)
5. **Monitor logs** for suspicious activity
6. **Keep dependencies updated**

---

## 📞 Support

### Get Help

- **GitHub Issues:** https://github.com/winzzy12/mail-dashboard/issues
- **Cloudflare Docs:** https://developers.cloudflare.com/workers/
- **Postfix Docs:** http://www.postfix.org/documentation.html

### Common Resources

- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [Postfix Basic Configuration](http://www.postfix.org/BASIC_CONFIGURATION_README.html)

---

## ✨ What's Next?

After successful installation:

1. ✅ Change admin password
2. ✅ Send test emails to verify
3. ✅ Configure DNS for custom domain (optional)
4. ✅ Setup logrotate for mail server
5. ✅ Backup database regularly
6. ✅ Star the GitHub repo! ⭐

---

**Installation complete! Enjoy Justblurry Mail! 📧**

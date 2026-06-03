-- Justblurry Mail Database Schema
-- Simple email storage for @justblurry.com

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    subject TEXT,
    text_body TEXT,
    html_body TEXT,
    raw_email TEXT,
    headers TEXT,
    received_at INTEGER NOT NULL,
    is_read INTEGER DEFAULT 0,
    is_starred INTEGER DEFAULT 0,
    folder TEXT DEFAULT 'inbox',
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_to_address ON emails(to_address);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- Users table (simple auth)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Insert default admin user (password: admin123)
-- Hash: sha256('admin123') for demo
INSERT OR IGNORE INTO users (email, password_hash, full_name) 
VALUES ('admin@justblurry.com', 'sha256:admin123', 'Administrator');

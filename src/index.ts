/**
 * Justblurry Mail - Email Management System
 * Receives emails from Postfix and stores in D1 database
 */

interface Env {
  DB: D1Database;
  APP_NAME: string;
  ADMIN_EMAIL: string;
}

interface EmailData {
  from: string;
  to: string;
  subject?: string;
  text_body?: string;
  html_body?: string;
  raw_email?: string;
  headers?: Record<string, string>;
  date?: string;
  message_id?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env, corsHeaders);
      }

      if (path === '/api/change-password' && request.method === 'POST') {
        return handleChangePassword(request, env, corsHeaders);
      }

      if (path === '/api/webhook' && request.method === 'POST') {
        return handleWebhook(request, env, corsHeaders);
      }

      if (path === '/api/emails' && request.method === 'GET') {
        return getEmails(request, env, corsHeaders);
      }

      if (path === '/api/emails/count' && request.method === 'GET') {
        return getEmailCount(env, corsHeaders);
      }

      if (path.startsWith('/api/emails/') && path.endsWith('/read') && request.method === 'POST') {
        const id = path.split('/')[3];
        return markAsRead(id, env, corsHeaders);
      }

      if (path.startsWith('/api/emails/') && request.method === 'DELETE') {
        const id = path.split('/')[3];
        return deleteEmail(id, env, corsHeaders);
      }

      if (path.startsWith('/api/emails/') && request.method === 'GET') {
        const id = path.split('/')[3];
        return getEmailById(id, env, corsHeaders);
      }

      if (path === '/api/test' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'ok',
          message: 'Justblurry Mail API is running',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Web Interface
      if (path === '/' || path === '/inbox') {
        return new Response(getWebInterface(), {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return new Response('Not Found', { status: 404 });

    } catch (error: any) {
      console.error('Error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Handle login with password validation
async function handleLogin(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { email, password } = await request.json();

    // Validate email format
    if (!email || !email.endsWith('@justblurry.com')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Please use a @justblurry.com email address'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check password against database
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Simple password check (in production, use bcrypt)
    // For now, check if password matches the stored hash
    const passwordMatch = user.password_hash === `sha256:${password}`;

    if (!passwordMatch) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Success - return user info
    return new Response(JSON.stringify({
      success: true,
      user: {
        email: user.email,
        full_name: user.full_name
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Login failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle change password
async function handleChangePassword(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { email, currentPassword, newPassword } = await request.json();

    // Validate inputs
    if (!email || !currentPassword || !newPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'All fields are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        error: 'New password must be at least 6 characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify current password
    const passwordMatch = user.password_hash === `sha256:${currentPassword}`;
    
    if (!passwordMatch) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Current password is incorrect'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update password
    await env.DB.prepare(`
      UPDATE users SET password_hash = ? WHERE email = ?
    `).bind(`sha256:${newPassword}`, email).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Password updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to change password'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle incoming email webhook from Postfix
async function handleWebhook(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const emailData: EmailData = await request.json();

    console.log('Received email:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject
    });

    // Validate required fields
    if (!emailData.from || !emailData.to) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: from, to'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate message_id if not provided
    const messageId = emailData.message_id || `<${Date.now()}@justblurry.com>`;
    
    // Parse date or use current timestamp
    const receivedAt = emailData.date 
      ? Math.floor(new Date(emailData.date).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Insert into database
    const result = await env.DB.prepare(`
      INSERT INTO emails (
        message_id, from_address, to_address, subject, 
        text_body, html_body, raw_email, headers, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      emailData.from,
      emailData.to,
      emailData.subject || '(No Subject)',
      emailData.text_body || '',
      emailData.html_body || '',
      emailData.raw_email || '',
      JSON.stringify(emailData.headers || {}),
      receivedAt
    ).run();

    console.log('Email saved to database:', result);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email received and stored',
      email_id: result.meta.last_row_id,
      message_id: messageId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    
    // Return 200 even on error so Postfix doesn't retry
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      note: 'Email was not stored but returning 200 to prevent Postfix retry'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get emails with pagination
async function getEmails(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const folder = url.searchParams.get('folder') || 'inbox';

  const result = await env.DB.prepare(`
    SELECT 
      id, message_id, from_address, to_address, subject,
      text_body, received_at, is_read, is_starred, folder,
      created_at
    FROM emails
    WHERE folder = ?
    ORDER BY received_at DESC
    LIMIT ? OFFSET ?
  `).bind(folder, limit, offset).all();

  return new Response(JSON.stringify({
    emails: result.results || [],
    count: result.results?.length || 0,
    limit,
    offset
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Get total email count
async function getEmailCount(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM emails
  `).first();

  return new Response(JSON.stringify({
    total: result?.total || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Get single email by ID
async function getEmailById(id: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM emails WHERE id = ?
  `).bind(id).first();

  if (!result) {
    return new Response(JSON.stringify({
      error: 'Email not found'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Mark email as read
async function markAsRead(id: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    await env.DB.prepare(`
      UPDATE emails SET is_read = 1 WHERE id = ?
    `).bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Email marked as read'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Delete email
async function deleteEmail(id: string, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    await env.DB.prepare(`
      DELETE FROM emails WHERE id = ?
    `).bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Email deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Web interface with login + dashboard (Cloud Mail style)
function getWebInterface(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Justblurry Mail</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f23;
            color: #e0e0e0;
            min-height: 100vh;
        }

        /* Login Page */
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            padding: 20px;
        }

        .login-box {
            background: rgba(30, 30, 50, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 48px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .login-header {
            text-align: center;
            margin-bottom: 40px;
        }

        .login-header h1 {
            font-size: 32px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
        }

        .login-header p {
            color: #a0a0a0;
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 24px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: #e0e0e0;
        }

        .form-group input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: #e0e0e0;
            font-size: 15px;
            transition: all 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .login-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
        }

        .login-btn:active {
            transform: translateY(0);
        }

        /* Dashboard */
        .dashboard {
            display: none;
            min-height: 100vh;
        }

        .dashboard.active {
            display: flex;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: rgba(20, 20, 35, 0.95);
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            padding: 24px;
            display: flex;
            flex-direction: column;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
        }

        .sidebar-header {
            margin-bottom: 32px;
        }

        .sidebar-header h2 {
            font-size: 24px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .sidebar-nav {
            flex: 1;
        }

        .nav-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 12px;
            color: #a0a0a0;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 15px;
        }

        .nav-item:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #e0e0e0;
        }

        .nav-item.active {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
            color: #667eea;
            font-weight: 600;
        }

        .nav-item span {
            margin-left: 12px;
        }

        .sidebar-footer {
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .user-info {
            display: flex;
            align-items: center;
            padding: 12px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            cursor: pointer;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            margin-right: 12px;
        }

        .user-details {
            flex: 1;
        }

        .user-email {
            font-size: 14px;
            color: #e0e0e0;
            font-weight: 500;
        }

        .change-password-btn {
            font-size: 12px;
            color: #a0a0a0;
            margin-top: 4px;
            cursor: pointer;
        }

        .change-password-btn:hover {
            color: #667eea;
        }

        .logout-btn {
            font-size: 12px;
            color: #a0a0a0;
            margin-top: 2px;
            cursor: pointer;
        }

        .logout-btn:hover {
            color: #ff6b6b;
        }

        /* Main Content */
        .main-content {
            margin-left: 260px;
            flex: 1;
            padding: 32px;
            background: #0f0f23;
        }

        .content-header {
            margin-bottom: 32px;
        }

        .content-header h1 {
            font-size: 32px;
            color: #e0e0e0;
            margin-bottom: 8px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: rgba(30, 30, 50, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 24px;
            transition: transform 0.2s, border-color 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-4px);
            border-color: rgba(102, 126, 234, 0.4);
        }

        .stat-label {
            font-size: 13px;
            color: #a0a0a0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 36px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* Email List */
        .email-list {
            background: rgba(30, 30, 50, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
        }

        .email-list-header {
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .email-list-header h2 {
            font-size: 20px;
            color: #e0e0e0;
        }

        .refresh-btn {
            padding: 8px 16px;
            background: rgba(102, 126, 234, 0.2);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 8px;
            color: #667eea;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .refresh-btn:hover {
            background: rgba(102, 126, 234, 0.3);
            border-color: rgba(102, 126, 234, 0.5);
        }

        .email-item {
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            cursor: pointer;
            transition: background 0.2s;
        }

        .email-item:hover {
            background: rgba(255, 255, 255, 0.03);
        }

        .email-item:last-child {
            border-bottom: none;
        }

        .email-item.unread {
            background: rgba(102, 126, 234, 0.05);
            border-left: 3px solid #667eea;
        }

        .email-item.unread .email-from {
            font-weight: 700;
            color: #fff;
        }

        .email-item.unread .email-subject {
            font-weight: 600;
            color: #8b9bff;
        }

        .email-item.unread::before {
            content: '●';
            position: absolute;
            left: 8px;
            top: 24px;
            color: #667eea;
            font-size: 12px;
        }

        .email-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 8px;
        }

        .email-from-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
        }

        .email-from {
            font-weight: 600;
            color: #e0e0e0;
            font-size: 15px;
        }

        .email-to-badge {
            display: inline-block;
            padding: 4px 10px;
            background: rgba(102, 126, 234, 0.15);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 6px;
            color: #667eea;
            font-size: 12px;
            font-weight: 500;
            width: fit-content;
        }

        .email-date {
            font-size: 13px;
            color: #888;
            white-space: nowrap;
            margin-left: 12px;
        }

        .email-subject {
            font-size: 16px;
            color: #667eea;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .email-preview {
            font-size: 14px;
            color: #888;
            line-height: 1.5;
        }

        .loading {
            text-align: center;
            padding: 60px;
            color: #888;
        }

        .empty-state {
            text-align: center;
            padding: 80px 20px;
        }

        .empty-state svg {
            width: 120px;
            height: 120px;
            margin-bottom: 24px;
            opacity: 0.3;
        }

        .empty-state h3 {
            color: #e0e0e0;
            margin-bottom: 8px;
        }

        .empty-state p {
            color: #888;
        }

        /* Email Detail Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 1000;
            overflow-y: auto;
            padding: 20px;
        }

        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: rgba(30, 30, 50, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
            padding: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-title {
            font-size: 20px;
            font-weight: 600;
            color: #e0e0e0;
        }

        .modal-close {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #e0e0e0;
            font-size: 20px;
            transition: all 0.2s;
        }

        .modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .delete-btn {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 8px;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #ff6b6b;
            font-size: 18px;
            transition: all 0.2s;
        }

        .delete-btn:hover {
            background: rgba(255, 107, 107, 0.2);
            border-color: rgba(255, 107, 107, 0.5);
            transform: scale(1.05);
        }

        .modal-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .email-detail-header {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .email-detail-subject {
            font-size: 24px;
            font-weight: 600;
            color: #e0e0e0;
            margin-bottom: 16px;
        }

        .email-detail-meta {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .email-meta-row {
            display: flex;
            gap: 12px;
            font-size: 14px;
        }

        .email-meta-label {
            color: #888;
            min-width: 60px;
        }

        .email-meta-value {
            color: #e0e0e0;
            flex: 1;
        }

        .email-detail-body {
            color: #e0e0e0;
            line-height: 1.6;
        }

        .email-detail-body iframe {
            width: 100%;
            min-height: 400px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            background: white;
        }

        .email-detail-body pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 16px;
            border-radius: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .email-view-toggle {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }

        .toggle-btn {
            padding: 8px 16px;
            background: rgba(102, 126, 234, 0.1);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 8px;
            color: #667eea;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .toggle-btn.active {
            background: rgba(102, 126, 234, 0.3);
            border-color: rgba(102, 126, 234, 0.5);
        }

        .toggle-btn:hover {
            background: rgba(102, 126, 234, 0.2);
        }

        @media (max-width: 768px) {
            .sidebar {
                display: none;
            }
            .main-content {
                margin-left: 0;
            }
        }
    </style>
</head>
<body>
    <!-- Login Page -->
    <div class="login-container" id="loginPage">
        <div class="login-box">
            <div class="login-header">
                <h1>✉️ Justblurry Mail</h1>
                <p>Sign in to your account</p>
            </div>
            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="email" placeholder="you@justblurry.com" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="Enter your password" required>
                </div>
                <button type="submit" class="login-btn">Sign In</button>
            </form>
        </div>
    </div>

    <!-- Dashboard -->
    <div class="dashboard" id="dashboard">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="sidebar-header">
                <h2>✉️ Justblurry</h2>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-item active" onclick="switchView('inbox')">
                    <span>📥</span>
                    <span>Inbox</span>
                </div>
                <div class="nav-item" onclick="switchView('sent')">
                    <span>📤</span>
                    <span>Sent</span>
                </div>
                <div class="nav-item" onclick="switchView('starred')">
                    <span>⭐</span>
                    <span>Starred</span>
                </div>
                <div class="nav-item" onclick="switchView('trash')">
                    <span>🗑️</span>
                    <span>Trash</span>
                </div>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar">A</div>
                    <div class="user-details">
                        <div class="user-email" id="userEmail">admin@justblurry.com</div>
                        <div class="change-password-btn" onclick="openChangePasswordModal()">Change Password</div>
                        <div class="logout-btn" onclick="handleLogout()">Logout</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <div class="content-header">
                <h1>Inbox</h1>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Emails</div>
                    <div class="stat-value" id="totalEmails">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Unread</div>
                    <div class="stat-value" id="unreadEmails">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Today</div>
                    <div class="stat-value" id="todayEmails">0</div>
                </div>
            </div>

            <div class="email-list">
                <div class="email-list-header">
                    <h2>Recent Messages</h2>
                    <button class="refresh-btn" onclick="loadEmails()">🔄 Refresh</button>
                </div>
                <div id="emailListContainer">
                    <div class="loading">Loading emails...</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Email Detail Modal -->
    <div class="modal" id="emailModal">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">Email Detail</div>
                <div style="display: flex; gap: 8px;">
                    <button class="delete-btn" onclick="deleteCurrentEmail()" title="Delete email">🗑️</button>
                    <div class="modal-close" onclick="closeEmailModal()">×</div>
                </div>
            </div>
            <div class="modal-body">
                <div class="email-detail-header">
                    <div class="email-detail-subject" id="modalSubject">Loading...</div>
                    <div class="email-detail-meta">
                        <div class="email-meta-row">
                            <div class="email-meta-label">From:</div>
                            <div class="email-meta-value" id="modalFrom"></div>
                        </div>
                        <div class="email-meta-row">
                            <div class="email-meta-label">To:</div>
                            <div class="email-meta-value" id="modalTo"></div>
                        </div>
                        <div class="email-meta-row">
                            <div class="email-meta-label">Date:</div>
                            <div class="email-meta-value" id="modalDate"></div>
                        </div>
                    </div>
                </div>
                <div class="email-view-toggle" id="viewToggle" style="display: none;">
                    <button class="toggle-btn" onclick="switchEmailView('html')">HTML</button>
                    <button class="toggle-btn" onclick="switchEmailView('text')">Text</button>
                </div>
                <div class="email-detail-body" id="modalBody">
                    Loading email...
                </div>
            </div>
        </div>
    </div>

    <!-- Change Password Modal -->
    <div class="modal" id="changePasswordModal">
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <div class="modal-title">Change Password</div>
                <div class="modal-close" onclick="closeChangePasswordModal()">×</div>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm" onsubmit="handleChangePassword(event)">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">Current Password</label>
                            <input type="password" id="currentPassword" required
                                style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e0e0e0; font-size: 14px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">New Password</label>
                            <input type="password" id="newPassword" required minlength="6"
                                style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e0e0e0; font-size: 14px;">
                            <small style="color: #888; font-size: 12px; margin-top: 4px; display: block;">Minimum 6 characters</small>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #e0e0e0; font-size: 14px;">Confirm New Password</label>
                            <input type="password" id="confirmPassword" required
                                style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e0e0e0; font-size: 14px;">
                        </div>
                        <button type="submit"
                            style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 12px; color: white; font-weight: 600; font-size: 16px; cursor: pointer; margin-top: 8px;">
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        // Simple auth (demo only - use real auth in production)
        async function handleLogin(event) {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = event.target.querySelector('button[type="submit"]');

            // Disable button during login
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';

            try {
                // Call login API
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('userEmail', email);
                    document.getElementById('loginPage').style.display = 'none';
                    document.getElementById('dashboard').classList.add('active');
                    document.getElementById('userEmail').textContent = email;
                    document.getElementById('userAvatar').textContent = email.charAt(0).toUpperCase();
                    loadEmails();
                } else {
                    alert(data.error || 'Invalid email or password');
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Sign In';
                }
            } catch (error) {
                alert('Login failed. Please try again.');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        }

        function handleLogout() {
            localStorage.removeItem('userEmail');
            document.getElementById('dashboard').classList.remove('active');
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('loginForm').reset();
        }

        function openChangePasswordModal() {
            document.getElementById('changePasswordModal').classList.add('active');
        }

        function closeChangePasswordModal() {
            document.getElementById('changePasswordModal').classList.remove('active');
            document.getElementById('changePasswordForm').reset();
        }

        async function handleChangePassword(event) {
            event.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const email = localStorage.getItem('userEmail');
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                alert('New passwords do not match');
                return;
            }
            
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
            
            try {
                const response = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, currentPassword, newPassword })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Password updated successfully!');
                    closeChangePasswordModal();
                } else {
                    alert(result.error || 'Failed to update password');
                }
            } catch (error) {
                alert('Error updating password: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }
        }

        function switchView(view) {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.closest('.nav-item').classList.add('active');
            
            if (view !== 'inbox') {
                alert('View: ' + view + ' - Coming soon!');
            }
        }

        async function loadEmails() {
            try {
                const container = document.getElementById('emailListContainer');
                container.innerHTML = '<div class="loading">Loading...</div>';

                // Get email count
                const countRes = await fetch('/api/emails/count');
                const countData = await countRes.json();
                document.getElementById('totalEmails').textContent = countData.total;

                // Get emails
                const emailsRes = await fetch('/api/emails?limit=100');
                const emailsData = await emailsRes.json();

                // Calculate stats
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayTimestamp = Math.floor(today.getTime() / 1000);
                const todayCount = emailsData.emails.filter(e => e.received_at >= todayTimestamp).length;
                const unreadCount = emailsData.emails.filter(e => e.is_read === 0).length;

                document.getElementById('todayEmails').textContent = todayCount;
                document.getElementById('unreadEmails').textContent = unreadCount;

                if (emailsData.emails.length === 0) {
                    container.innerHTML = \`
                        <div class="empty-state">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
                            <h3>No emails yet</h3>
                            <p>Send an email to @justblurry.com to get started</p>
                        </div>
                    \`;
                    return;
                }

                container.innerHTML = emailsData.emails.map(email => {
                    const date = new Date(email.received_at * 1000);
                    const preview = (email.text_body || '').substring(0, 120);
                    const isToday = email.received_at >= todayTimestamp;
                    const timeStr = isToday 
                        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const unreadClass = email.is_read === 0 ? 'unread' : '';

                    return \`
                        <div class="email-item \${unreadClass}" onclick="viewEmail(\${email.id})">
                            <div class="email-header">
                                <div class="email-from-group">
                                    <div class="email-from">\${email.from_address}</div>
                                    <div class="email-to-badge">📬 \${email.to_address}</div>
                                </div>
                                <div class="email-date">\${timeStr}</div>
                            </div>
                            <div class="email-subject">\${email.subject || '(No Subject)'}</div>
                            <div class="email-preview">\${preview}\${preview.length >= 120 ? '...' : ''}</div>
                        </div>
                    \`;
                }).join('');

            } catch (error) {
                document.getElementById('emailListContainer').innerHTML = 
                    '<div class="loading" style="color: #ff6b6b;">Error loading emails: ' + error.message + '</div>';
            }
        }

        async function viewEmail(id) {
            try {
                // Show modal
                document.getElementById('emailModal').classList.add('active');
                
                // Fetch email detail
                const response = await fetch('/api/emails/' + id);
                const email = await response.json();
                
                // Mark as read
                fetch('/api/emails/' + id + '/read', { method: 'POST' });
                
                // Populate modal
                document.getElementById('modalSubject').textContent = email.subject || '(No Subject)';
                document.getElementById('modalFrom').textContent = email.from_address;
                document.getElementById('modalTo').textContent = email.to_address;
                
                const date = new Date(email.received_at * 1000);
                document.getElementById('modalDate').textContent = date.toLocaleString();
                
                // Store email data for view switching
                window.currentEmail = email;
                
                // Show toggle if HTML exists
                if (email.html_body && email.html_body.trim()) {
                    document.getElementById('viewToggle').style.display = 'flex';
                    switchEmailView('html'); // Default to HTML view
                } else {
                    document.getElementById('viewToggle').style.display = 'none';
                    // Show text only
                    const bodyDiv = document.getElementById('modalBody');
                    bodyDiv.innerHTML = '<pre>' + (email.text_body || '(No content)') + '</pre>';
                }
                
            } catch (error) {
                alert('Failed to load email: ' + error.message);
                closeEmailModal();
            }
        }

        function switchEmailView(view) {
            const email = window.currentEmail;
            const bodyDiv = document.getElementById('modalBody');
            const buttons = document.querySelectorAll('.toggle-btn');
            
            // Update button states
            buttons.forEach(btn => {
                btn.classList.remove('active');
                if ((view === 'text' && btn.textContent === 'Text') || 
                    (view === 'html' && btn.textContent === 'HTML')) {
                    btn.classList.add('active');
                }
            });
            
            if (view === 'html') {
                // Show HTML in iframe
                const iframe = document.createElement('iframe');
                iframe.srcdoc = email.html_body;
                iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms';
                bodyDiv.innerHTML = '';
                bodyDiv.appendChild(iframe);
            } else {
                // Show text
                bodyDiv.innerHTML = '<pre>' + (email.text_body || '(No content)') + '</pre>';
            }
        }

        function closeEmailModal() {
            document.getElementById('emailModal').classList.remove('active');
            window.currentEmail = null;
        }

        async function deleteCurrentEmail() {
            if (!window.currentEmail) return;
            
            const emailId = window.currentEmail.id;
            const confirmed = confirm('Delete this email? This cannot be undone.');
            
            if (!confirmed) return;
            
            try {
                const response = await fetch('/api/emails/' + emailId, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    closeEmailModal();
                    loadEmails(); // Reload email list
                    alert('Email deleted successfully');
                } else {
                    alert('Failed to delete email: ' + result.error);
                }
            } catch (error) {
                alert('Error deleting email: ' + error.message);
            }
        }

        // Close modal on background click
        document.addEventListener('click', function(e) {
            const modal = document.getElementById('emailModal');
            if (e.target === modal) {
                closeEmailModal();
            }
        });

        // Check if already logged in
        window.onload = function() {
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail) {
                document.getElementById('loginPage').style.display = 'none';
                document.getElementById('dashboard').classList.add('active');
                document.getElementById('userEmail').textContent = userEmail;
                document.getElementById('userAvatar').textContent = userEmail.charAt(0).toUpperCase();
                loadEmails();
            }
        };

        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (document.getElementById('dashboard').classList.contains('active')) {
                loadEmails();
            }
        }, 30000);
    </script>
</body>
</html>
  `;
}

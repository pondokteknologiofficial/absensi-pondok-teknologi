const crypto = require('crypto');
const db = require('./db');

// Hash password using Node.js built-in scrypt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt
  };
}

// Verify password
function verifyPassword(password, hash, salt) {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

// Check if any admin user exists in DB
async function hasAdminUser() {
  const row = await db.queryOne('SELECT COUNT(*) as count FROM users');
  return row && Number(row.count) > 0;
}

// Register first admin user
async function createFirstAdmin(username, password) {
  const exists = await hasAdminUser();
  if (exists) {
    throw new Error('Akun admin sudah ada. Pendaftaran pertama ditutup.');
  }

  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  if (cleanUser.length < 3) {
    throw new Error('Username minimal 3 karakter');
  }
  if (cleanPass.length < 4) {
    throw new Error('Password minimal 4 karakter');
  }

  const { hash, salt } = hashPassword(cleanPass);
  const result = await db.run(`
    INSERT INTO users (username, password_hash, salt, role)
    VALUES (?, ?, ?, 'ADMIN')
  `, [cleanUser, hash, salt]);

  return { id: result.lastInsertRowid, username: cleanUser };
}

// Authenticate user credentials
async function authenticate(username, password) {
  const cleanUser = (username || '').trim();
  const user = await db.queryOne('SELECT * FROM users WHERE username = ?', [cleanUser]);
  if (!user) return null;

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

// Create persistent session
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  // Expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  await db.run(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `, [token, userId, expiresAt]);

  return { token, expiresAt };
}

// Validate session token
async function validateSession(token) {
  if (!token) return null;
  try {
    const row = await db.queryOne(`
      SELECT s.token, s.expires_at, u.id, u.username, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now', 'localtime')
    `, [token]);

    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      role: row.role
    };
  } catch (err) {
    console.error('validateSession error:', err);
    return null;
  }
}

// Destroy session (logout)
async function destroySession(token) {
  if (!token) return;
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

// Middleware to protect routes
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies.pt_session : null;
    const user = await validateSession(token);

    if (user) {
      req.user = user;
      // Prevent browser cache on authenticated pages
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return next();
    }

    // Not authenticated
    const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                  (req.baseUrl && req.baseUrl.startsWith('/api')) ||
                  req.path.startsWith('/api/') || 
                  (req.headers.accept && req.headers.accept.includes('application/json'));

    if (isApi) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Sesi telah berakhir atau Anda belum login'
      });
    }

    // Web page redirect to /login
    return res.redirect('/login');
  } catch (err) {
    console.error('requireAuth error:', err);
    return res.redirect('/login');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  hasAdminUser,
  createFirstAdmin,
  authenticate,
  createSession,
  validateSession,
  destroySession,
  requireAuth
};

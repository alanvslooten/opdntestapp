'use strict';
/**
 * server.js — HTTP-server voor de Observatie-app.
 * Geen externe dependencies: draait met enkel Node.js (>=18).
 *
 *   npm start      of      node server.js
 *
 * Omgevingsvariabele PORT wordt gebruikt indien aanwezig (standaard 3000).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dagen

/* ------------------------------------------------------------------
   SESSIES (in-memory token -> gebruiker)
------------------------------------------------------------------ */
const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId, expires: Date.now() + SESSION_MS });
  return token;
}
function readSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)session=([a-f0-9]+)/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.expires < Date.now()) { sessions.delete(m[1]); return null; }
  return { token: m[1], userId: s.userId };
}
function currentUser(req) {
  const s = readSession(req);
  if (!s) return null;
  return db.getUsers().find(u => u.id === s.userId) || null;
}
function publicUser(u) {
  return { id: u.id, naam: u.naam, email: u.email, rol: u.rol };
}

/* ------------------------------------------------------------------
   HULPFUNCTIES
------------------------------------------------------------------ */
function sendJSON(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, extraHeaders || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function statusFor(volgendeISO) {
  const d = Math.round((new Date(volgendeISO).getTime() - Date.now()) / 86400000);
  if (d < 0 || d <= 14) return 'urgent';
  if (d <= 30) return 'soon';
  return 'ok';
}
function withStatus(kid) {
  return Object.assign({}, kid, { status: statusFor(kid.volgende) });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Niet gevonden'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ------------------------------------------------------------------
   SERVER
------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method = req.method;

  try {
    /* =================== API =================== */
    if (pathname.startsWith('/api/')) {

      /* --- Login (publiek) --- */
      if (pathname === '/api/login' && method === 'POST') {
        const { email, password } = await readBody(req);
        const user = db.getUsers().find(
          u => u.email === String(email || '').toLowerCase().trim()
        );
        if (!user || !db.verifyPassword(String(password || ''), user.password)) {
          return sendJSON(res, 401, { error: 'Ongeldig e-mailadres of wachtwoord' });
        }
        const token = createSession(user.id);
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        return sendJSON(res, 200, publicUser(user), {
          'Set-Cookie': `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`
        });
      }

      /* --- Alle overige API-routes vereisen authenticatie --- */
      const user = currentUser(req);
      if (!user) return sendJSON(res, 401, { error: 'Niet ingelogd' });

      if (pathname === '/api/logout' && method === 'POST') {
        const s = readSession(req);
        if (s) sessions.delete(s.token);
        return sendJSON(res, 200, { ok: true }, {
          'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0'
        });
      }

      if (pathname === '/api/me' && method === 'GET') {
        return sendJSON(res, 200, publicUser(user));
      }

      if (pathname === '/api/kinderen' && method === 'GET') {
        return sendJSON(res, 200, db.getKinderen().map(withStatus));
      }

      let m = pathname.match(/^\/api\/kinderen\/(\d+)$/);
      if (m && method === 'GET') {
        const kid = db.getKind(m[1]);
        if (!kid) return sendJSON(res, 404, { error: 'Kind niet gevonden' });
        return sendJSON(res, 200, withStatus(kid));
      }

      m = pathname.match(/^\/api\/kinderen\/(\d+)\/observaties$/);
      if (m && method === 'POST') {
        const kid = db.getKind(m[1]);
        if (!kid) return sendJSON(res, 404, { error: 'Kind niet gevonden' });
        const { datum, leidster, notitie } = await readBody(req);
        const updated = db.addObservatie(kid.id, { datum, leidster, notitie, door: user.naam });
        return sendJSON(res, 201, withStatus(updated));
      }

      if (pathname === '/api/leidsters' && method === 'GET') {
        return sendJSON(res, 200, db.getLeidsterStats(statusFor));
      }

      if (pathname === '/api/settings' && method === 'GET') {
        return sendJSON(res, 200, db.getSettings());
      }

      if (pathname === '/api/settings' && method === 'PUT') {
        if (user.rol !== 'beheerder') {
          return sendJSON(res, 403, { error: 'Alleen beheerders kunnen instellingen wijzigen' });
        }
        const patch = await readBody(req);
        return sendJSON(res, 200, db.updateSettings(patch));
      }

      return sendJSON(res, 404, { error: 'Onbekende API-route' });
    }

    /* =================== PAGINA'S =================== */
    if (pathname === '/login' || pathname === '/login.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'login.html'));
    }

    if (pathname === '/' || pathname === '/index.html') {
      if (!currentUser(req)) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
    }

    /* =================== STATISCHE BESTANDEN =================== */
    const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safe);
    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveStatic(res, filePath);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Niet gevonden');

  } catch (e) {
    console.error('[fout]', e);
    sendJSON(res, 500, { error: 'Interne serverfout' });
  }
});

server.listen(PORT, () => {
  console.log('────────────────────────────────────────────────');
  console.log('  Observatie-app — Op d\'n Buiten');
  console.log('  Draait op:  http://localhost:' + PORT);
  console.log('  Inloggen:   beheerder  gail@opdnbuiten.nl  / beheerder2026');
  console.log('              medewerker emma@opdnbuiten.nl  / medewerker2026');
  console.log('────────────────────────────────────────────────');
});

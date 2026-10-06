const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// --- CONFIGURACIÓN DE USUARIOS ---
// Para agregar más usuarios, añadir más entradas: 'usuario': 'contraseña'
const USERS = {
  'admin': '123456'
};

// Sesiones en memoria (válidas 8 horas)
const sessions = new Map();
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function parseCookies(req) {
  const list = {};
  const header = req.headers.cookie;
  if (!header) return list;
  header.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    list[name.trim()] = decodeURIComponent(rest.join('=').trim());
  });
  return list;
}

function cleanOldSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      sessions.delete(id);
    }
  }
}

// ─── MIDDLEWARES BASE ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Archivos estáticos disponibles para todos (necesario para cargar la página de login)
app.use(express.static(path.join(__dirname, 'public')));

// ─── ENDPOINTS PÚBLICOS (sin auth) ──────────────────────────────────────────

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  if (USERS[username] && USERS[username] === password) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { user: username, createdAt: Date.now() });
    const maxAge = SESSION_MAX_AGE_MS / 1000;
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/`);
    return res.json({ success: true, user: username });
  }
  return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

// Logout
app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.sessionId) sessions.delete(cookies.sessionId);
  res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/');
  return res.json({ success: true });
});

// Check session (para que el frontend sepa si ya está autenticado al recargar)
app.get('/api/me', (req, res) => {
  cleanOldSessions();
  const cookies = parseCookies(req);
  const session = sessions.get(cookies.sessionId);
  if (session) {
    return res.json({ authenticated: true, user: session.user });
  }
  return res.status(401).json({ authenticated: false });
});

// ─── MIDDLEWARE DE AUTENTICACIÓN para el resto de la API ────────────────────
app.use('/api', (req, res, next) => {
  cleanOldSessions();
  const cookies = parseCookies(req);
  if (!cookies.sessionId || !sessions.has(cookies.sessionId)) {
    return res.status(401).json({ error: 'No autenticado. Por favor iniciá sesión.' });
  }
  next();
});

// ─── CONFIG INICIAL ─────────────────────────────────────────────────────────
const INITIAL_CONFIG = {
  neuquenLocal: {
    id: 'neuquenLocal',
    name: 'Boletines Neuquén (Ciudad y Provincia)',
    description: 'Alertas locales (Medios e Impuestos)',
    keywords: [
      'publicidad', 'medios de comunicación', 'medios de comunicacion',
      'vía pública', 'via publica', 'radio', 'televisión', 'television',
      'impuesto', 'permisos de contrucción', 'permisos de construccion',
      'licencia comercial', 'reduccion de tasas', 'reducción de tasas',
      'tenencia precaria', 'reduccion de alicuota', 'reducción de alícuota',
      'fiesta de la confluencia'
    ],
    emails: [
      'pedonim@lmneuquen.com', 'trepianaa@lmneuquen.com', 'casagrandea@lmneuquen.com.ar',
      'halonso@lmneuquen.com.ar', 'jschroeder@lu5am.com.ar', 'npiccoli@lmneuquen.com.ar',
      'dpotenzoni@lebensalud.com'
    ]
  },
  boraGroup1: {
    id: 'boraGroup1',
    name: 'BORA: Vaca Muerta / Energía',
    description: 'Boletín Oficial de la República Argentina (Sector Energético)',
    keywords: ['vaca muerta', 'energía', 'energia', 'hidrocarburos'],
    emails: [
      'ojedaa@lmneuquen.com.ar', 'navazoc@mase.com.ar', 'mmongelluzzo@lmneuquen.com.ar',
      'pedonim@lmneuquen.com', 'dpotenzoni@lebensalud.com', 'npiccoli@lmneuquen.com.ar',
      'jschroeder@lu5am.com.ar'
    ]
  },
  boraGroup2: {
    id: 'boraGroup2',
    name: 'BORA: Neuquén / Río Negro',
    description: 'Boletín Oficial de la República Argentina (Regiones)',
    keywords: ['neuquén', 'neuquen', 'río negro', 'rio negro'],
    emails: [
      'pedonim@lmneuquen.com', 'trepianaa@lmneuquen.com', 'casagrandea@lmneuquen.com.ar',
      'halonso@lmneuquen.com.ar', 'dpotenzoni@lebensalud.com', 'npiccoli@lmneuquen.com.ar',
      'jschroeder@lu5am.com.ar'
    ]
  },
  individuals: []
};

function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) { saveConfig(INITIAL_CONFIG); return INITIAL_CONFIG; }
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
    if (!config.individuals) { config.individuals = []; saveConfig(config); }
    return config;
  } catch (e) { return INITIAL_CONFIG; }
}

function saveConfig(config) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); return true; }
  catch (e) { return false; }
}

// ─── ENDPOINTS PROTEGIDOS ───────────────────────────────────────────────────

app.get('/api/config', (req, res) => res.json(getConfig()));

app.post('/api/config/:groupId/keywords', (req, res) => {
  const { groupId } = req.params;
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword requerida' });
  const config = getConfig();
  if (!config[groupId]) return res.status(404).json({ error: 'Grupo no encontrado' });
  const newKw = keyword.trim().toLowerCase();
  if (config[groupId].keywords.includes(newKw)) return res.status(400).json({ error: 'La palabra ya existe' });
  config[groupId].keywords.push(newKw);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.delete('/api/config/:groupId/keywords/:keyword', (req, res) => {
  const { groupId, keyword } = req.params;
  const config = getConfig();
  if (!config[groupId]) return res.status(404).json({ error: 'Grupo no encontrado' });
  config[groupId].keywords = config[groupId].keywords.filter(kw => kw !== keyword);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.post('/api/config/:groupId/emails', (req, res) => {
  const { groupId } = req.params;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const config = getConfig();
  if (!config[groupId]) return res.status(404).json({ error: 'Grupo no encontrado' });
  const newEmail = email.trim().toLowerCase();
  if (config[groupId].emails.includes(newEmail)) return res.status(400).json({ error: 'El email ya existe' });
  config[groupId].emails.push(newEmail);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.delete('/api/config/:groupId/emails/:email', (req, res) => {
  const { groupId, email } = req.params;
  const config = getConfig();
  if (!config[groupId]) return res.status(404).json({ error: 'Grupo no encontrado' });
  config[groupId].emails = config[groupId].emails.filter(e => e !== email);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.get('/api/individuals', (req, res) => res.json(getConfig().individuals || []));

app.post('/api/individuals', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const config = getConfig();
  const newEmail = email.trim().toLowerCase();
  if (config.individuals.find(i => i.email === newEmail)) return res.status(400).json({ error: 'El usuario ya existe' });
  config.individuals.push({ email: newEmail, keywords: [] });
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.delete('/api/individuals/:email', (req, res) => {
  const { email } = req.params;
  const config = getConfig();
  config.individuals = config.individuals.filter(i => i.email !== email);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.post('/api/individuals/:email/keywords', (req, res) => {
  const { email } = req.params;
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword requerida' });
  const config = getConfig();
  const user = config.individuals.find(i => i.email === email);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const newKw = keyword.trim().toLowerCase();
  if (user.keywords.includes(newKw)) return res.status(400).json({ error: 'La palabra ya existe' });
  user.keywords.push(newKw);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.delete('/api/individuals/:email/keywords/:keyword', (req, res) => {
  const { email, keyword } = req.params;
  const config = getConfig();
  const user = config.individuals.find(i => i.email === email);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  user.keywords = user.keywords.filter(kw => kw !== keyword);
  saveConfig(config);
  res.json({ success: true, config: getConfig() });
});

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`=================================`);
});

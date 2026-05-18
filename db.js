'use strict';
/**
 * db.js — eenvoudige, bestand-gebaseerde opslag (data/data.json).
 * Geen externe database nodig: ideaal om snel te hosten.
 * Bij de eerste start wordt de dataset automatisch geseed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateKinderen, LEIDSTERS, KLEUREN } = require('./seed');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

/* ---------- Wachtwoorden (scrypt, ingebouwd in Node) ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ---------- Verse dataset (2 gebruikers + kinderen + settings) ---------- */
function freshData() {
  return {
    users: [
      {
        id: 1,
        naam: 'Gail Baselier',
        email: 'gail@opdnbuiten.nl',
        rol: 'beheerder',
        password: hashPassword('beheerder2026')
      },
      {
        id: 2,
        naam: 'Emma de Vries',
        email: 'emma@opdnbuiten.nl',
        rol: 'medewerker',
        password: hashPassword('medewerker2026')
      }
    ],
    kinderen: generateKinderen(),
    settings: {
      org_naam: "Op d'n Buiten",
      locatie: 'Rietgoorsestraat 105, Roosendaal',
      cyclus: 6,
      notif_email: true,
      notif_4weken: true,
      notif_dagelijks: false,
      notif_afvink: true
    },
    nextObsId: 100000
  };
}

/* ---------- Laden / opslaan ---------- */
let cache = null;
function load() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else {
    cache = freshData();
    persist();
    console.log('[db] Nieuwe dataset geseed naar', DATA_FILE);
  }
  return cache;
}
function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

function addMonths(dateISO, n) {
  const r = new Date(dateISO);
  r.setMonth(r.getMonth() + n);
  return r.toISOString();
}

/* ---------- Publieke API ---------- */
module.exports = {
  hashPassword,
  verifyPassword,

  getUsers: () => load().users,

  getKinderen: () => load().kinderen,

  getKind: (id) => load().kinderen.find(k => k.id === Number(id)) || null,

  getSettings: () => load().settings,

  updateSettings(patch) {
    const d = load();
    const allowed = ['org_naam', 'locatie', 'cyclus', 'notif_email', 'notif_4weken', 'notif_dagelijks', 'notif_afvink'];
    for (const key of allowed) {
      if (key in patch) d.settings[key] = patch[key];
    }
    persist();
    return d.settings;
  },

  addObservatie(kidId, obs) {
    const d = load();
    const kid = d.kinderen.find(k => k.id === Number(kidId));
    if (!kid) return null;
    const datum = obs.datum ? new Date(obs.datum).toISOString() : new Date().toISOString();
    const entry = {
      id: d.nextObsId++,
      datum,
      leidster: String(obs.leidster || ''),
      notitie: String(obs.notitie || ''),
      door: String(obs.door || '')
    };
    kid.observaties.unshift(entry);
    kid.observaties.sort((a, b) => new Date(b.datum) - new Date(a.datum));
    kid.laatste = kid.observaties[0].datum;
    kid.leidster = kid.observaties[0].leidster;
    kid.volgende = addMonths(kid.laatste, d.settings.cyclus || 6);
    persist();
    return kid;
  },

  getLeidsterStats(statusFn) {
    const d = load();
    return LEIDSTERS.map((naam, i) => {
      const kinderen = d.kinderen.filter(k => k.leidster === naam);
      const totaalObs = d.kinderen.reduce(
        (sum, k) => sum + k.observaties.filter(o => o.leidster === naam).length, 0
      );
      const urgent = kinderen.filter(k => statusFn(k.volgende) === 'urgent').length;
      return {
        naam,
        kleur: KLEUREN[i % KLEUREN.length],
        aantalKinderen: kinderen.length,
        totaalObs,
        urgent
      };
    });
  }
};

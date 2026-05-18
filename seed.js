'use strict';
/**
 * seed.js — genereert de demo-dataset (80 kinderen + observaties).
 * Deterministisch dankzij een vaste PRNG-seed, maar relatief aan de
 * huidige datum zodat de status-verdeling (urgent/binnenkort/op schema)
 * altijd realistisch is.
 */

const LEIDSTERS = [
  'Emma de Vries', 'Sophie Janssen', 'Lisa Bakker', 'Anna van den Berg',
  'Mia Visser', 'Laura Smit', 'Noor Peters', 'Sara Mulder',
  'Julia Dekker', 'Fleur Bos', 'Iris Schouten', 'Roos Vermeer'
];

const KLEUREN = [
  '#1E88C7', '#2C9DA0', '#5CA82E', '#E08A00',
  '#C45D3E', '#5C6BC0', '#3F8E6E', '#B57A2E'
];

const VOORNAMEN_M = ['Liam','Noah','Lucas','Oliver','Finn','Sem','Daan','Tom','Max','Jesse','Tim','Lars','Bram','Niels','Pieter','David','Sander','Ruben','Joris','Thijs'];
const VOORNAMEN_V = ['Emma','Olivia','Nora','Lena','Mia','Sara','Julia','Anna','Fleur','Roos','Lisa','Sophie','Iris','Eva','Fenna','Tess','Hanna','Nina','Lotte','Amber'];
const ACHTERNAMEN = ['de Vries','Bakker','Visser','Smit','Meijer','de Boer','Mulder','Dekker','Leeuw','Janssen','van Dijk','Peters','Bos','Vermeer','van den Berg','Schouten','Brouwer','van Dam','Koster','Hofman'];
const NOTITIES = ['Gaat goed!','Ontwikkeling op schema.','Actief en vrolijk.','Taalvaardigheid groeit.','Motorische ontwikkeling goed.','Zelfstandiger geworden.'];

function generateKinderen() {
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };

  const today = new Date();
  const kinderen = [];
  let obsId = 1;

  for (let i = 0; i < 80; i++) {
    const isM = rnd() > 0.5;
    const naam = (isM ? pick(VOORNAMEN_M) : pick(VOORNAMEN_V)) + ' ' + pick(ACHTERNAMEN);
    const groep = i < 40 ? 'Groep A' : 'Groep B';
    const daysAgo = between(30, 1095);
    const inschrijf = addDays(today, -daysAgo);

    let laatste = null, leidster = null, volgende, observaties = [];
    const heeftObs = rnd() > 0.2;

    if (heeftObs) {
      const numObs = between(1, 4);
      let lastDate = null;
      for (let j = 0; j < numObs; j++) {
        const obsAgo = between(1, Math.min(daysAgo - 1, 240) * (j === 0 ? 1 : 0.5));
        const obsDate = addDays(today, -Math.max(1, Math.round(obsAgo)));
        const l = pick(LEIDSTERS);
        observaties.push({
          id: obsId++,
          datum: obsDate.toISOString(),
          leidster: l,
          notitie: NOTITIES[Math.floor(rnd() * NOTITIES.length)],
          door: 'Systeem (import)'
        });
        if (!lastDate || obsDate > lastDate) { lastDate = obsDate; laatste = obsDate; leidster = l; }
      }
      observaties.sort((a, b) => new Date(b.datum) - new Date(a.datum));
      volgende = addMonths(laatste, 6);
    } else {
      volgende = addMonths(inschrijf, 6);
    }

    kinderen.push({
      id: i,
      naam,
      groep,
      inschrijf: inschrijf.toISOString(),
      laatste: laatste ? laatste.toISOString() : null,
      leidster,
      volgende: volgende.toISOString(),
      kleur: KLEUREN[i % KLEUREN.length],
      observaties
    });
  }
  return kinderen;
}

module.exports = { generateKinderen, LEIDSTERS, KLEUREN };

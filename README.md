# Observatie-app — Op d'n Buiten

Een complete webapplicatie voor het bijhouden van observatiecycli van kinderen
bij kinderopvang **Op d'n Buiten** (Roosendaal). Material 3-interface, een
ingebouwde backend met authenticatie, en twee gebruikersrollen.

---

## Wat zit erin

- **Frontend** — Material 3 webinterface (dashboard, observatieoverzicht,
  kindprofielen, leidsters, instellingen). Responsive: werkt op desktop en mobiel.
- **Backend** — HTTP-server in pure Node.js. REST API + authenticatie met sessies.
- **Opslag** — een eenvoudig JSON-bestand (`data/data.json`). Geen losse database
  nodig. Wordt bij de eerste start automatisch gevuld met 80 demo-kinderen.
- **Geen externe dependencies** — er hoeft niets geïnstalleerd te worden.
  De app draait met alleen Node.js.

---

## Vereisten

- **Node.js versie 18 of hoger** (getest met Node 22). Verder niets.

Controleer je versie met:

    node --version

---

## Lokaal starten

In de projectmap:

    node server.js

of:

    npm start

Open daarna in je browser: **http://localhost:3000**

De server kiest poort 3000, tenzij de omgevingsvariabele `PORT` is ingesteld:

    PORT=8080 node server.js

---

## Inloggen — demo-accounts

| Rol         | E-mailadres            | Wachtwoord       |
|-------------|------------------------|------------------|
| Beheerder   | gail@opdnbuiten.nl     | `beheerder2026`  |
| Medewerker  | emma@opdnbuiten.nl     | `medewerker2026` |

Op de inlogpagina kun je ook op een demo-account klikken om de gegevens
automatisch in te vullen.

### Verschil tussen de rollen

- **Beheerder** — volledige toegang, inclusief de pagina **Instellingen**
  (organisatiegegevens, observatiecyclus, notificaties).
- **Medewerker** — ziet het dashboard, het observatieoverzicht, kindprofielen
  en leidsters, en kan observaties afvinken. De pagina **Instellingen** is
  verborgen. De server weigert bovendien wijzigingen aan instellingen door een
  medewerker (foutmelding 403), ook bij directe API-aanroepen.

---

## Online hosten

De app draait op elk platform dat Node.js ondersteunt. Algemene aanpak:

1. Upload de volledige projectmap.
2. Stel het startcommando in op `node server.js` (of `npm start`).
3. De meeste platforms geven zelf een poort door via de `PORT`-variabele —
   de app gebruikt die automatisch.

Werkt onder meer op Render, Railway, Fly.io, een eigen VPS, enzovoort.
Er is geen build-stap en geen `npm install` nodig.

> **Let op — gegevens bij hosting:** sommige platforms hebben een tijdelijk
> bestandssysteem; bij een herstart of nieuwe deploy kan `data/data.json`
> dan terug naar de begintoestand. Voor blijvende opslag koppel je een
> persistente schijf aan de map `data/`, of vervang je de opslaglaag in
> `db.js` door een echte database.

---

## API-overzicht

Alle routes behalve `/api/login` vereisen een geldige sessie.

| Methode | Route                              | Omschrijving                          |
|---------|------------------------------------|---------------------------------------|
| POST    | `/api/login`                       | Inloggen                              |
| POST    | `/api/logout`                      | Uitloggen                             |
| GET     | `/api/me`                          | Huidige gebruiker                     |
| GET     | `/api/kinderen`                    | Alle kinderen (met statusberekening)  |
| GET     | `/api/kinderen/:id`                | Eén kind                              |
| POST    | `/api/kinderen/:id/observaties`    | Observatie toevoegen                  |
| GET     | `/api/leidsters`                   | Leidsters met statistieken            |
| GET     | `/api/settings`                    | Instellingen ophalen                  |
| PUT     | `/api/settings`                    | Instellingen wijzigen (alleen beheerder) |

---

## Gegevens opnieuw instellen

Verwijder het bestand `data/data.json` en start de server opnieuw. De
dataset (80 kinderen, observaties, instellingen) wordt dan opnieuw aangemaakt.

---

## Projectstructuur

    observatie-app/
    ├── server.js          HTTP-server, routering, API, authenticatie
    ├── db.js              Opslaglaag (JSON), wachtwoord-hashing
    ├── seed.js            Genereert de demo-dataset
    ├── package.json       Startscript en Node-versievereiste
    ├── public/
    │   ├── login.html     Inlogpagina
    │   └── index.html     De applicatie zelf
    └── data/
        └── data.json      Wordt automatisch aangemaakt bij de eerste start

---

## Beveiliging — voor echt gebruik

Dit is een werkende demo. Voordat je hem met echte gegevens in gebruik neemt:

- **Wijzig de wachtwoorden** van beide accounts (zie `db.js`, functie
  `freshData`). Wachtwoorden worden gehasht met scrypt.
- Draai de app achter **HTTPS** (de sessiecookie wordt dan automatisch
  als `Secure` gemarkeerd).
- Overweeg een echte database in plaats van het JSON-bestand wanneer er
  meerdere mensen tegelijk mee werken.

---

*Gemaakt voor Op d'n Buiten — Kinderopvang Roosendaal.*

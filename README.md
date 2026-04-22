# Hisøy Miljø nettside

Dette prosjektet er startgrunnlaget for den nye nettsiden til Hisøy Miljø. Oppsettet er laget for å være enkelt å videreutvikle med Codex, lett å legge i GitHub og rett fram å publisere med Netlify.

## Hva som er satt opp

- En responsiv startside i [index.html](./index.html)
- En enkel 404-side i [404.html](./404.html)
- Designsystem og layout i [styles/main.css](./styles/main.css)
- Liten interaksjon i [scripts/main.js](./scripts/main.js)
- Ikoner i [assets](./assets)
- Netlify-konfigurasjon i [netlify.toml](./netlify.toml)
- Innholds- og lanseringsmal i [docs/innhold-vi-trenger.md](./docs/innhold-vi-trenger.md)

## Prosjektstruktur

```text
/
|-- assets/
|-- docs/
|-- scripts/
|-- styles/
|-- 404.html
|-- index.html
|-- netlify.toml
`-- README.md
```

## Lokal forhåndsvisning

Det enkleste er å åpne `index.html` direkte i nettleser.

Hvis dere vil kjøre en enkel lokal server, kan dere bruke Python:

```powershell
python -m http.server 8080
```

Åpne deretter `http://localhost:8080`.

## Slik legger dere prosjektet i GitHub

1. Opprett et nytt tomt repository i GitHub-kontoen `HisoyMiljo`, for eksempel `hisoy-miljo-nettside`.
2. Kjør disse kommandoene fra prosjektmappen:

```powershell
git init
git add .
git commit -m "Opprett startgrunnlag for Hisøy Miljø nettside"
git branch -M main
git remote add origin https://github.com/HisoyMiljo/hisoy-miljo-nettside.git
git push -u origin main
```

Hvis repository-navnet blir noe annet, bytt bare ut URL-en i `git remote add origin`.

## Slik kobler dere GitHub til Netlify

1. Logg inn på Netlify.
2. Velg `Add new site` og deretter `Import an existing project`.
3. Koble til GitHub-kontoen som eier repoet.
4. Velg repository for Hisøy Miljø.
5. Bruk disse innstillingene:

```text
Build command: (tom)
Publish directory: .
```

6. Klikk `Deploy site`.

Netlify vil deretter publisere på nytt automatisk hver gang dere pusher endringer til `main`.

## Hva Codex trenger videre

Fyll inn malen i [docs/innhold-vi-trenger.md](./docs/innhold-vi-trenger.md) og send innholdet tilbake i denne tråden. Når det er gjort, kan Codex:

- skrive endelig tekst til forsiden
- legge inn ekte kontaktinformasjon
- bygge undersider for tjenester
- sette inn bilder og referanser
- tilpasse siden til ønsket visuell profil

## Anbefalt neste beskjed til Codex

```text
Bruk innholdet i docs/innhold-vi-trenger.md og bygg en ferdig førsteversjon av nettsiden til Hisøy Miljø. Lag tydelige seksjoner for tjenester, hvorfor velge oss, referanser og kontakt.
```

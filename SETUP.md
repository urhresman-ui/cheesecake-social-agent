# Setup

Koraki, da agent dejansko zaživi. Vse spodnje je enkraten poseg (razen
osveževanja Drive mape z novo vsebino, kar je sprotno).

## 1. Google Drive mapa

Že pripravljeno: mapa **"Us & Cheesecake — Social Content"** obstaja v
Urhovem Google Drive:
`https://drive.google.com/drive/folders/1Ov7IeMt0XnYpgbYKfEcRRRDfFSVdi2lY`

Vanjo naloži fotografije/videe, ki naj jih agent uporablja (poljubno število,
poljuben vrstni red - agent bere neposredno iz mape, brez podmap).

## 2. Google Cloud service account (za dostop do Drive)

1. Pojdi na [console.cloud.google.com](https://console.cloud.google.com/),
   ustvari nov projekt (ali uporabi obstoječega), npr. "cheesecake-social".
2. V "APIs & Services" → "Library" omogoči **Google Drive API**.
3. V "APIs & Services" → "Credentials" → "Create credentials" → "Service
   account". Ime poljubno (npr. `cheesecake-drive-reader`), brez dodatnih
   vlog (Drive dostop urejamo prek deljenja mape, ne prek IAM vlog).
4. Odpri ustvarjeni service account → zavihek "Keys" → "Add key" → "Create
   new key" → JSON. Prenese se `.json` datoteka - **iz nje potrebuješ**:
   - `client_email` → env var `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → env var `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (pri
     vnosu v Vercel pusti prelome vrstic kot so v datoteki, ali jih zamenjaj
     z `\n` - koda v `lib/drive.ts` oboje podpira).
5. **Deli Drive mapo iz koraka 1** s tem service accountom: v Google Drive
   desni klik na mapo → "Share" → prilepi `client_email` naslov service
   accounta → vloga "Viewer" zadostuje (agent samo bere).

⚠️ `.json` datoteko s ključem hrani zasebno, nikoli je ne commitaj v repo.

## 3. Upstash Redis

1. Na [upstash.com](https://upstash.com) ustvari nov Redis database (Free
   tier zadostuje za ta obseg).
2. Iz "REST API" zavihka skopiraj `UPSTASH_REDIS_REST_URL` in
   `UPSTASH_REDIS_REST_TOKEN`.

(Lahko tudi uporabiš isto Upstash bazo kot `jarvis-hub`, ker so ključi
prefiksirani z `social:` in se ne prekrivajo z `instagram:` ključi - a ločena
baza je čistejša za neodvisen deployment.)

## 4. Resend (e-mail obvestila)

Če že imaš Resend account (uporabljen v `jarvis-hub`), lahko ponovno
uporabiš isti `RESEND_API_KEY`. Sicer ustvari novega na
[resend.com](https://resend.com) (brezplačen tier zadostuje).

`NOTIFY_EMAIL` = `urh.resman@gmail.com` (ali kamor želiš prejemati obvestila).

## 5. Vercel projekt

1. Na [vercel.com](https://vercel.com/new) uvozi repozitorij
   `urhresman-ui/cheesecake-social-agent`.
2. Framework preset: Next.js (samodejno zaznano).
3. V "Environment Variables" dodaj:

   | Ime | Vrednost |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | iz koraka 2 |
   | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | iz koraka 2 |
   | `GOOGLE_DRIVE_FOLDER_ID` | `1Ov7IeMt0XnYpgbYKfEcRRRDfFSVdi2lY` |
   | `ANTHROPIC_API_KEY` | tvoj Anthropic API ključ |
   | `UPSTASH_REDIS_REST_URL` | iz koraka 3 |
   | `UPSTASH_REDIS_REST_TOKEN` | iz koraka 3 |
   | `RESEND_API_KEY` | iz koraka 4 |
   | `NOTIFY_EMAIL` | `urh.resman@gmail.com` |
   | `SOCIAL_AGENT_TOKEN` | poljuben dolg naključen niz (npr. `openssl rand -hex 32`) - varuje `/pregled` in interne API-je |
   | `CRON_SECRET` | poljuben dolg naključen niz - varuje cron poti (Vercel ga samodejno pošlje kot `Authorization: Bearer` cron klicem, ko je nastavljen kot env var) |
   | `PUBLIC_BASE_URL` | `https://<tvoj-projekt>.vercel.app` (za povezavo v e-mail obvestilih - nastavi po prvem deployu, ko poznaš pravi URL) |

4. Deploy. Cron urniki iz `vercel.json` (tedenski post, delavniški story) se
   samodejno aktivirajo.

## 6. Prvi ročni test

Ko so env vars nastavljeni in je projekt deployan, lahko cron sprožiš ročno:

```bash
curl -X GET "https://<tvoj-projekt>.vercel.app/api/social/cron/propose-story" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Če v Drive mapi obstaja vsaj ena fotografija/video, bi moral prejeti e-mail
s povezavo do `/pregled?token=<SOCIAL_AGENT_TOKEN>`.

## 7. GitHub repo na Private (neobvezno)

Repo je trenutno Public (GitHub je pri poskusu nastavitve na Private
zahteval e-mail potrditev, ki je nisem mogel dokončati namesto tebe). Ker
repo ne vsebuje nobenih skrivnosti (vse je v Vercel env vars), to ni
nujno - če pa želiš, dokončaj na
`github.com/urhresman-ui/cheesecake-social-agent/settings` → "Danger Zone" →
"Change visibility".

# cheesecake-social-agent

Samostojen agent, ki za Us & Cheesecake pripravlja predloge za Instagram
objave (feed post + story): izbere neuporabljeno fotografijo/video iz
Google Drive mape, z Anthropic API pripravi caption v znamkinem slogu, za
fotografije obreže/uredi/vžge kratko besedilo, in obvesti Urha po e-pošti.
**Agent sam ničesar ne objavi na Instagram** - Urh na pregledni strani
pregleda, po želji uredi besedilo, prenese gotovo sliko (ali odpre video v
Drive) in ga ročno objavi v Instagram aplikaciji.

Ločen repozitorij od `jarvis-hub` (ista ideja/arhitektura, druga naloga -
brez povezave z Instagram Graph API ali Meta appom).

## Kako deluje

```
Vercel Cron (tedensko, pon)  ──► GET /api/social/cron/propose-post
Vercel Cron (pon-pet)        ──► GET /api/social/cron/propose-story
                                    │
                    izbere neuporabljeno Drive datoteko (lib/social/select.ts),
                    pokliče Anthropic API za caption (lib/social/caption.ts),
                    shrani proposal v Upstash Redis (lib/social/store.ts),
                    pošlje Urhu e-mail (lib/social/notify.ts) s povezavo do /pregled
                                    │
                    Urh odpre /pregled?token=... :
                    - fotografija: živ predogled urejene slike
                      (app/api/social/image/[id], lib/social/image.ts - sharp:
                      obreže na pravo razmerje, barvni preset, vžge besedilo),
                      uredljiv caption, gumb "Prenesi gotovo sliko"
                    - video: povezava do izvirnika v Google Drive + predlog
                      urejanja (editSuggestion) + caption
                    - "Objavil sem, označi kot gotovo" -> POST /api/social/complete
                      (samo označi proposal + Drive file kot uporabljen,
                      NE objavlja nič na Instagram)
```

## Datoteke

- `lib/drive.ts` - Google Drive dostop (service account JWT), listanje mape,
  streamanje datotek.
- `lib/social/store.ts` - Upstash Redis shramba predlogov (status: `pending`
  → `done`/`rejected`) + set uporabljenih Drive datotek po tipu.
- `lib/social/select.ts` - izbere naključno neuporabljeno datoteko.
- `lib/social/caption.ts` + `captionPrompt.ts` - Anthropic klic za caption
  (znamkin slog Us & Cheesecake).
- `lib/social/image.ts` - `sharp`: obreži na razmerje (post 4:5, story
  9:16), barvni preset, vžig besedila.
- `lib/social/notify.ts` - Resend e-mail obvestila.
- `lib/social/auth.ts` - bearer/token guard za interne API-je in `/pregled`.
- `app/api/social/*` - cron sprožilci, CRUD za predloge, image proxy.
- `app/pregled/page.tsx` - pregledna stran (dostop prek `?token=`).

## Setup

Glej [SETUP.md](./SETUP.md) za natančna navodila (Google service account,
Drive mapa, Upstash, Resend, Vercel env vars in cron).

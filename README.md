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
                    izbere neuporabljeno Drive datoteko (lib/social/select.ts) -
                    če je na voljo več neuporabljenih fotografij, jih
                    Anthropic vision klic (lib/social/rank.ts) najprej
                    združi po vizualni podobnosti (npr. burst posnetki iste
                    torte) in izbere najboljšo v vsaki skupini, samo ta
                    vstopi v izbor,
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
                      (označi proposal + Drive file (in morebitne vizualno
                      podobne "sorodne" datoteke iz istega AI izbora) kot
                      uporabljene, NE objavlja nič na Instagram)
```

Ista datoteka se za en tip (POST ali STORY) nikoli ne predlaga dvakrat -
Upstash Redis hrani množico uporabljenih Drive file ID-jev po tipu
(`lib/social/store.ts`). Za fotografije gre ta zaščita še korak dlje: ko je
na voljo več neuporabljenih fotografij hkrati, `lib/social/rank.ts` z
Anthropic vision klicem prepozna vizualno skoraj enake posnetke (npr. isti
kader iz burst-a), izbere najboljšo v vsaki skupini in ob potrditvi označi
kot uporabljene vse iz te skupine - ne samo tisto, ki je bila dejansko
predlagana. Video vsebina te AI primerjave nima (prehudo/nezanesljivo brez
ffmpeg pipeline-a na Vercel serverless) - videi se ločijo samo po
enostavnem "že uporabljen ali ne" pravilu.

Poleg tega agent pred vsakim captionom (samo bere, ne objavlja) prebere
zadnjih ~15 objav na pravem Instagram feedu (`lib/social/feed.ts`, Instagram
Graph API) in prompt eksplicitno prosi, naj se izogne ponavljanju istih tem/
besednih zvez. Neobvezno - brez `INSTAGRAM_ACCESS_TOKEN` env var se ta korak
tiho preskoči.

## Datoteke

- `lib/drive.ts` - Google Drive dostop (service account JWT), listanje mape,
  streamanje datotek.
- `lib/social/store.ts` - Upstash Redis shramba predlogov (status: `pending`
  → `done`/`rejected`) + set uporabljenih Drive datotek po tipu.
- `lib/social/select.ts` - izbere neuporabljeno datoteko (za fotografije
  prek `rank.ts`, glej zgoraj).
- `lib/social/rank.ts` - Anthropic vision klic: med kandidatnimi
  fotografijami prepozna vizualno podobne/skoraj podvojene, izbere
  najboljšo v vsaki skupini.
- `lib/social/feed.ts` - prebere zadnje objave na pravem IG feedu (samo
  branje), da caption prompt ve, česa se izogibati.
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

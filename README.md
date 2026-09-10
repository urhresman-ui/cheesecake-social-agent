# cheesecake-social-agent

Samostojen agent, ki za Us & Cheesecake pripravlja predloge za Instagram
objave (feed post + story): izbere neuporabljeno fotografijo/video iz
Google Drive mape (med vizualno podobnimi izbere najboljšo) in z Anthropic
API pripravi besedilo v znamkinem slogu, nato obvesti Urha po e-pošti.
**Agent slike ne ureja in ničesar ne objavi na Instagram** - fotografijo/
video pusti nedotaknjeno, Urh na pregledni strani vidi izvirnik, po želji
uredi predlagano besedilo, ga po potrebi sam doda v Instagram aplikaciji
(nalepka na storyju, napis na sliki, urejanje videa) in ročno objavi.

Ločen repozitorij od `jarvis-hub` (ista ideja/arhitektura, druga naloga).

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
                    prebere zadnje prave objave na IG feedu (lib/social/feed.ts,
                    samo branje) kot referenco za slog in da se izogne
                    ponavljanju tem,
                    pokliče Anthropic API za besedilo (lib/social/caption.ts),
                    shrani proposal v Upstash Redis (lib/social/store.ts),
                    pošlje Urhu e-mail (lib/social/notify.ts) s povezavo do /pregled
                                    │
                    Urh odpre /pregled?token=... :
                    - fotografija: izvirna, NEUREJENA slika (app/api/social/image/[id]
                      samo prenese/po potrebi pomanjša za prikaz, ne obreže/
                      barva/vžge ničesar), predlog kratkega besedila
                      (shortText) in za POST tudi poln IG opis (caption) -
                      oboje uredljivo, prenese se lahko izvirna fotografija
                    - video: povezava do izvirnika v Google Drive + predlog
                      urejanja (editSuggestion) + kratek predlog besedila
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

Poleg tega agent pred vsakim besedilom (samo bere, ne objavlja) prebere
zadnjih ~15 objav na pravem Instagram feedu (`lib/social/feed.ts`, Instagram
Graph API) - to uporabi kot referenco za pravi slog/ton znamke IN da se
izogne ponavljanju istih tem/besednih zvez. Neobvezno - brez
`INSTAGRAM_ACCESS_TOKEN` env var se ta korak tiho preskoči.

## Datoteke

- `lib/drive.ts` - Google Drive dostop (service account JWT), listanje mape,
  streamanje/branje datotek.
- `lib/social/store.ts` - Upstash Redis shramba predlogov (status: `pending`
  → `done`/`rejected`) + set uporabljenih Drive datotek po tipu.
- `lib/social/select.ts` - izbere neuporabljeno datoteko (za fotografije
  prek `rank.ts`, glej zgoraj).
- `lib/social/rank.ts` - Anthropic vision klic: med kandidatnimi
  fotografijami prepozna vizualno podobne/skoraj podvojene, izbere
  najboljšo v vsaki skupini.
- `lib/social/feed.ts` - prebere zadnje objave na pravem IG feedu (samo
  branje), za slog in da caption prompt ve, česa se izogibati.
- `lib/social/caption.ts` + `captionPrompt.ts` - Anthropic klic za besedilo
  (znamkin slog Us & Cheesecake, brez klišejev, slovnično natančno).
- `lib/social/json.ts` - robustno izvleče JSON iz odgovora modela (modeli
  včasih dodajo markdown ograjice ali odvečne znake).
- `lib/social/notify.ts` - Resend e-mail obvestila.
- `lib/social/auth.ts` - bearer/token guard za interne API-je in `/pregled`.
- `app/api/social/*` - cron sprožilci, CRUD za predloge, image proxy (samo
  prenos/pomanjšava za prikaz, brez urejanja).
- `app/pregled/page.tsx` - pregledna stran (dostop prek `?token=`).

## Setup

Glej [SETUP.md](./SETUP.md) za natančna navodila (Google service account,
Drive mapa, Upstash, Resend, Instagram token, Vercel env vars in cron).

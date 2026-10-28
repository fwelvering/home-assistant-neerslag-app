# Card source

`neerslag-card.src.js` is the source of the Lovelace card (`custom:neerslag-card`).
HA/HACS serve the *bundled* file `custom_components/neerslag/home-assistant-neerslag-card/neerslag-card.js`
(lit, chart.js and the annotation plugin are bundled in; the source has bare imports and does not load in a browser).

After changing the source, rebuild the bundle and commit both:

```bash
cd card-src
npm ci
npm run build   # writes ../custom_components/neerslag/home-assistant-neerslag-card/neerslag-card.js
node --check ../custom_components/neerslag/home-assistant-neerslag-card/neerslag-card.js
```

# Ordering kiosk, side off

An interactive isometric figure of how a self-service ordering kiosk works, from the touch to the kitchen and the pickup board.

- Light: https://chengboonrong.github.io/kiosk-anatomy/
- Dark: https://chengboonrong.github.io/kiosk-anatomy/dark.html

Tap the screen to order, tap the card to pay. Break it with the buttons: paper low, unplug the network, decline a card, or a big order that needs a PIN.

## Source

Everything is in `src/`, plain Node ESM with no dependencies:

| File | What it is |
|---|---|
| `build.mjs` | Builds the drawing and writes `index.html` (with `--light`) or `dark.html` |
| `live.js` | The page's behaviour: the order flow, the card, pulses on the cables, the kitchen and the failure modes |
| `model.mjs` | Every number the figure shows: prices, timings, printer and roll sizes |
| `parts.mjs` | Drawing helpers shared by the build and the page (card, receipt, paper web) |
| `screen.mjs` | The kiosk app and the pickup board, in panel pixels |
| `kiosk.css` | Styles on top of the kit |
| `kit/` | The isometric drawing kit (MIT, see `KIT-LICENSE`) |

```sh
node src/build.mjs --light          # writes index.html
node src/build.mjs                  # writes dark.html
node src/build.mjs --light --audit  # also checks the geometry: clearances, depth order, cable ends
```

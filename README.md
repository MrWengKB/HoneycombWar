# Honeycomb War

A turn-based strategy game on a honeycomb board, played in the browser: https://mrwengkb.github.io/HoneycombWar/

## Rules

- The board is a big hexagon of small hex cells. Each base sits in the middle of the second row from its player's edge (you at the bottom, the opponent at the top).
- On your turn, take one grey cell next to your cells, or attack an opponent cell next to your cells. Every move uses the turn.
- Attack: your attack − their defense = damage. Damage above 0 captures the cell. Bases can't be captured.
- A cell captured this turn can't be recaptured on the opponent's very next turn.
- If a cell where you found +attack or +defense is captured, you lose that boost for good. −attack and −defense you found stay with you.
- Hidden items are revealed when a cell is taken: +attack, −attack, +defense, −defense (1–4 each), wall (1–2 layers on that cell) and ring (also take the 6 cells around it).
- Walls: any hit with damage ≥ 1 removes exactly one layer per turn; a walled cell can't be captured until its wall is gone.
- Enclosing an area with your cells (the board edge counts) takes the whole area. Rings and enclosures also take opponent cells without walls, unless the opponent's defense is greater than your attack.
- All of a player's cells share one attack and one defense.
- Pass: a player may pass instead of moving. Passing twice in a row while the opponent keeps playing loses; if both players pass one after the other, the game ends on cell count.
- Centre base: the centre cell can be claimed from round 3. Whoever holds it gets extra defense equal to the level (friend games: the starting strength). It can't be attacked or enclosed; it changes hands only when the other player surrounds all 6 cells around it (and can't be taken back on the very next turn). Only the home base decides the game.
- Win by surrounding the opponent's base. Retiring gives the win to the opponent.
- When the board is full and nobody captures for 2 rounds (4 moves), the player with more cells wins; equal cells is a draw.
- Round limit: 3 × the number of cells. When it is reached, most cells wins (equal is a draw).

## Levels (vs CPU)

Win or draw to level up. Levels 1–4 use a board with 5 cells per side, 5–8 use 6, and so on up to 15. After that only the number of hidden items grows. Starting attack and defense both equal the level. The CPU doesn't know where items are hidden.

## Friend mode

Pass and play, or face to face across a tablet. Choose board size, number of hidden items, all / positive-only / negative-only items, and starting strength. Friend games don't change your level.

## Saving

Optional Google sign-in (same OAuth client as Class Manager, `drive.file` scope). Progress is saved as an AES-GCM encrypted file in a “Honeycomb War” folder in the player's own Google Drive, and in the browser. Without signing in, data stays only in this browser.

## Files

- `index.html`, `style.css`
- `js/game.js` rules engine (also runs in Node), `js/cpu.js` CPU player
- `js/ui.js` board drawing and dialogs, `js/main.js` screens and game flow
- `js/auth.js` Google sign-in, `js/drive.js` Drive file, `js/crypto.js` encryption, `js/store.js` profile
- `tests/game.test.js`: `node tests/game.test.js`

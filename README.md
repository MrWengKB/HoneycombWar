# Honeycomb War

A turn-based strategy game on a honeycomb board, played in the browser.

## Rules

- The board is a big hexagon of small hex cells. Each base sits in the middle of the second row from its player's edge (you at the bottom, the opponent at the top).
- On your turn, take one grey cell next to your cells, or attack an opponent cell next to your cells. Every move uses the turn.
- Attack: your attack − their defense = damage. Damage above 0 captures the cell. Bases can't be captured.
- A cell captured this turn can't be recaptured on the opponent's very next turn.
- If a cell where you found +attack or +defense is captured, you lose that boost for good. −attack and −defense you found stay with you.
- Hidden items are revealed when a cell is taken: +attack, −attack, +defense, −defense (1–4 each), wall (1–2 layers on that cell) and ring (also take the 6 cells around it).
- Hidden mines: a third of the cells per side, rounded down (none in friend games with positive items only). Taking a mine's cell directly (claiming it or capturing it) blows up that cell and the 6 around it: they turn black, belong to nobody and can never be taken, and count as the board edge for enclosures. A mine taken by a ring or an enclosure stays hidden until the other player captures that cell. Blasts never reach a base, the centre base or the cells next to them.
- Walls: any hit with damage ≥ 1 removes exactly one layer per turn; a walled cell can't be captured until its wall is gone.
- Enclosing an area with your cells (the board edge counts) takes the whole area. Rings and enclosures also take opponent cells without walls, unless the opponent's defense is greater than your attack.
- All of a player's cells share one attack and one defense.
- Pass: a player may pass instead of moving. Passing twice in a row while the opponent keeps playing loses; if both players pass one after the other, the game ends on cell count.
- Centre base: the centre cell can be claimed from round 3. Whoever holds it gets extra defense: the level for levels 1–4, level − 1 at 5–6, − 2 at 7–8, − 3 at 9–10, − 4 at 11–12, then 8 (friend games use the starting strength). It can't be attacked or enclosed; it changes hands only when the other player surrounds all 6 cells around it (and can't be taken back on the very next turn). Only the home base decides the game.
- Win by surrounding the opponent's base. Retiring gives the win to the opponent.
- Cells are also counted when neither player's number of cells has changed for 3 rounds (6 moves), even if cells are traded back and forth.
- When the board is full and nobody captures for 2 rounds (4 moves), the player with more cells wins; equal cells is a draw.
- Round limit: 3 × the number of cells. When it is reached, most cells wins (equal is a draw).

## Levels (vs CPU)

Win or draw to level up. Levels 1–4 use a board with 5 cells per side, 5–8 use 6, and so on up to 15. After that only the number of hidden items grows. Starting attack and defense both equal the level. The CPU doesn't know where items are hidden.

## Friend mode

Pass and play, or face to face across a tablet. Choose board size, number of hidden items, all / positive-only / negative-only items, and starting strength. Friend games don't change your level.

## Saving

Optional Google sign-in (same OAuth client as Class Manager, `drive.file` scope). Progress is saved as an AES-GCM encrypted file in a “Honeycomb War” folder in the player's own Google Drive, and in the browser. Without signing in, data stays only in this browser.

## Background music

“New Sunrise” from OpenGameArt.org, https://opengameart.org/content/new-sunrise. License: CC0 1.0 Universal (public domain), https://creativecommons.org/publicdomain/zero/1.0/. It's the same track used in [ELAdventure](https://github.com/MrWengKB/ELAdventure). Players turn it on with the “Play background music” tickbox on the main menu (off by default). Credits are also shown in the game under “Music credits”.

## Android app

`android/` wraps the web game in an offline Android app, built the same way as HanziQuery: the web files are copied into the APK's assets and loaded with `WebViewAssetLoader`.

- **Release:** add a new `# vX.Y.Z` section at the top of `version-history.md` and push to main. GitHub Actions (`.github/workflows/build-android.yml`) runs the tests, builds the APK and publishes it as the `apk-latest` release (download: https://github.com/MrWengKB/HoneycombWar/releases/tag/apk-latest).
- **Updates:** the app checks `apk-latest` when it starts (and from "Check for updates" in the menu) and offers Install, Later or Ignore.
- **Support the author:** a menu button shows one rewarded AdMob ad (IDs in `android/app/src/main/res/values/admob.xml`).
- **Signing:** a fixed key in `android/app/honeycombwar.keystore` (like HanziQuery), so every build installs over the previous one.
- **Google sign-in:** the app uses the phone's own Google account picker (play-services-auth AuthorizationClient) and passes the access token to the page, so saves go to the same Drive file as the website. It needs an Android OAuth client in the same Google Cloud project: package `io.github.mrwengkb.honeycombwar`, SHA-1 `5B:87:8E:EA:02:F8:15:BB:A5:56:B4:55:A3:81:0F:7C:59:9B:10:75`.
- **Google Play:** the same build also makes `HoneycombWar.aab` (release build, `PLAY_STORE = true`: no "Check for updates", Play handles updates). The repo keystore is the Play upload key. After the first upload, add the **app signing key** SHA-1 from Play Console (Test and release › App integrity) to a second Android OAuth client, or Google sign-in won't work in the Play version. Play app signing key SHA-1: `5C:23:C0:1C:36:D7:C5:BE:DB:34:0E:8F:64:B0:A9:66:FD:4A:BE:44`.

## Files

- `index.html`, `style.css`
- `js/game.js` rules engine (also runs in Node), `js/cpu.js` CPU player
- `js/music.js` background music (`music/bgm.mp3`), `js/sound.js` sound effects (Web Audio, no files), `js/ui.js` board drawing and dialogs, `js/main.js` screens and game flow
- `js/auth.js` Google sign-in, `js/drive.js` Drive file, `js/crypto.js` encryption, `js/store.js` profile
- `tests/game.test.js`: `node tests/game.test.js`

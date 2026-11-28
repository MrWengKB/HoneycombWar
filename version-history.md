# v1.9.17
- New "Suggest a feature" link at the bottom of the menu, for sending ideas for the game

# v1.9.16
- The Android app now also uses Google Analytics to count visits and see which pages are used, like the website. It never sees your game data, level, names or Google Drive files
- The privacy page explains this

# v1.9.15
- The website now uses Google Analytics to count visits and see which pages are used. It never sees your game data, level, names or Google Drive files. The Android app does not use it
- The privacy page explains this, and now links to the general privacy policy at mrwengkb.com

# v1.9.14
- Traditional Chinese (蜂窩戰爭), with Taiwan wording, for the game, the how-to, the privacy and delete-data pages, the app's update prompt, the ad messages and the app name on the home screen
- Language buttons "En 简 繁" on the sign-in screen and the main menu. The choice is remembered on this device and wins over the phone or browser language
- Without a choice, phones and browsers set to Chinese (Taiwan), Chinese (Hong Kong) or Traditional Chinese now get Traditional Chinese; other Chinese gets Simplified
- On the website, ?lang=en, ?lang=zh or ?lang=tw in the address still picks a language for that visit

# v1.9.13
- The end-of-game message now says whose base was surrounded: "Your base" or "CPU's base" against the CPU, and the players' names in friend games (also in Chinese)
- A retired game now says who retired

# v1.9.12
- Simplified Chinese: the game, the how-to, the privacy and delete-data pages and the app's update prompt are shown in Chinese (蜂窝战争) when the phone or browser language is Chinese, and in English otherwise
- On the website, add ?lang=zh or ?lang=en to the address to pick a language by hand

# v1.9.11
- The 2nd bases are now called castles: same gold cells, same rules, new name everywhere in the game and the how-to

# v1.9.10
- Fixed: a wall's W number now counts down by 1 each time it is hit, and at 0 the badge goes and the cell can be captured like any other

# v1.9.9
- Smarter CPU with several 2nd bases: once you take one, it races you for the free ones instead of letting you have them, and it drops a straight-for-your-base plan while you hold more 2nd bases than it does

# v1.9.8
- More 2nd bases at high levels: 2 from level 50 (middle row, at the thirds), 3 from level 100 (middle row, at the quarters), 4 from level 200 (halfway between the centre and each side without a base) and 5 from level 350 (those 4 plus the centre)
- Each 2nd base adds its own extra defense, is taken only by surrounding it, and one player can hold them all
- With several 2nd bases the CPU picks a plan at random: go straight for your base, or race for one of the 2nd bases

# v1.9.7
- Android: if Google sign-in fails, the message now shows the app's package and signing SHA-1, so it can be checked against Google Cloud
- Android: a sign-in error is no longer reported as "cancelled"

# v1.9.6
- Smarter CPU: it now races for the centre base, closes in on yours, and guards its own; its own base ring only matters once it is under attack

# v1.9.5
- Fixed: after going to the menu and back during the CPU's turn, the CPU could also make moves for you

# v1.9.4
- Faster endings: when neither player's number of cells has changed for 3 rounds, the cells are counted and the game ends

# v1.9.3
- If Google sign-in fails in the app, the message now shows Google's reason, to help fix it

# v1.9.2
- Mines: a third of the cells per side, rounded down (1 on the smallest board, up to 5 on the biggest)

# v1.9.1
- If Google Drive has more than one save file (for example one restored by hand), the game reads them all and keeps the one with the most progress

# v1.9.0
- New hidden item: the mine. Take its cell directly and it blows up that cell and the 6 around it, turning them black for good
- 1 mine up to level 15, 2 from level 16; a mine taken by a ring or an enclosure waits until the other player captures that cell
- Explosion sound and a "Mines" line in the level info

# v1.8.4
- Safer saving: when two saves differ, the one with more games played is kept, so a new device can never replace your progress
- If Google Drive can't be read, the game no longer writes to it until it can
- A Drive save the game can't open is never overwritten, and progress made on this device before signing in counts too

# v1.8.3
- Google Play version of the app (updates come from Play, so it has no "Check for updates")

# v1.8.2
- "Support the author" now shows real ads from Honeycomb War's own AdMob account

# v1.8.1
- Android app: sign in with Google (the phone's own account picker) to keep your progress in Google Drive, the same as on the website

# v1.8.0
- First Android app: the whole game is built in and plays offline
- "Support the author" button (watch one ad) and "Check for updates" in the app's menu
- The app checks for a new version when it starts; you choose Install, Later or Ignore

# v1.7.0
- Optional background music ("New Sunrise", CC0) with music credits

# v1.6.0
- Sound effects, with a mute button in the game

# v1.5.0
- Centre base: claim it from round 3 for extra defense; it can only be taken by surrounding it

# v1.4.0
- Pass button: passing twice in a row loses; both players passing ends the game on cell count

# v1.3.0
- Suggest retiring when there is no way back

# v1.1.0
- A captured cell can't be taken back on the next turn; captured cells lose their boosts; round limit

# v1.0.0
- First version of Honeycomb War

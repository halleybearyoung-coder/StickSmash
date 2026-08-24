# StickSmash

A local, couch-multiplayer, Smash-Bros-style fighting game starring hand-drawn stick figures. Two fighters duke it out on a floating platform stage — rack up damage %, then knock your opponent off the stage to take their stock. Three stocks each; last one standing wins. Pick your stage and your fighter — each fighter has their own moveset.

Built entirely with vanilla HTML5 canvas + JavaScript, no build step, no game engine. The character animations are real hand-drawn sprite sheets, auto-extracted from flip-book-style reference sheets and re-composited as transparent PNG frames.

## Play it

Just open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

It's also set up for GitHub Pages — enable Pages on this repo (Settings → Pages → Deploy from branch → `main` / root) and it'll be playable at `https://<your-username>.github.io/StickSmash/`.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | `A` / `D` | `←` / `→` |
| Jump (double-jump: tap again in air) | `W` | `↑` |
| Fast-fall / drop through platform | `S` | `↓` |
| Attack 1 | `F` | `K` |
| Attack 2 | `G` | `L` |
| Special | `R` | `I` |
| Special 2 | `T` | `O` |
| Special 3 | `Y` | `P` |

What each button actually does depends on which fighter you pick — see below. `Enter` / `Space` confirms menus. `R` rematches after a KO (not to be confused with P1's special button during a match). `Esc` returns to the menu.

## Modes

- **2-Player Local** — same keyboard, split controls as above.
- **1-Player vs CPU** — a lightweight AI opponent that closes distance, attacks in range, jumps to intercept, and tries not to walk itself off the stage.

## Fighters

- **Twilight** — the balanced all-rounder. Punch (fast, mostly-vertical knockback, a good combo starter) and kick (slower, harder, more horizontal knockback — the move that actually finishes stocks off the sides). Fireball is a ranged projectile. Spin uppercut launches Twilight upward and doubles as a recovery move. Laser charges for up to 2 seconds while held (fizzles if you get hit or leave the ground) — the longer the charge, the more damage and knockback.
- **Lance** — a sword fighter. Slice on the ground, air slice while airborne (same two buttons, resolved automatically by whether Lance is grounded), both with longer sword reach than fists. His third button is the sword tornado: a heavy, multi-hit spin that ticks damage repeatedly on anyone caught inside it — built to rack up a lot of damage fast. Lance has no ranged projectile or recovery uppercut, so his double-jump is his only way back to the stage.

## How the fight works

- Damage is tracked as a percentage per player — the higher it climbs, the farther a hit sends you flying (classic Smash-style knockback scaling).
- Platforms let you juggle, escape, or reset the neutral game; double-jumping through the stage lets you recover from off-stage.
- Fall past the dashed blast-zone boundary in any direction and you lose a stock and respawn at center stage with a moment of invulnerability.
- Pick your stage on the stage-select screen — several floating islands and battlefields, each with a different layout and palette.

## Project structure

```
index.html            entry point / menu / char-select / stage-select / HUD screens
style.css              visual styling (hand-drawn paper aesthetic)
game.js                 all game logic: physics, animation, combat, AI, rendering
build_artifact.py        bundles everything into one self-contained HTML file
                          (auto-discovers sprite actions from assets/frames/,
                          so new characters/moves never need a manual list update)
assets/frames/*.png     extracted sprite frames (5 frames per action), transparent PNG
```

`game.js` is written so the same file also works inside a single-file bundled build — it looks for a `window.SPRITE_BASE64` map first and falls back to loading `assets/frames/*.png` relatively, so it works equally well as a plain static site or a fully self-contained HTML file. Run `python3 build_artifact.py` to produce `sticksmash_artifact.html`.

Each fighter is defined in `game.js`'s `CHARACTERS` array with a `moveMap` — it maps the punch/kick/fireball/uppercut/laser input slots to that character's actual moves (a fixed move, a grounded/airborne resolver function like Lance's slice/air-slice, or `null` to disable the slot). Adding a new fighter is: draw the sprite sheets, extract frames into `assets/frames/`, add a `CHARACTERS` entry with stats + `moveMap`, add any new `MOVES` entries.

## Ideas for what's next

- More fighters
- More per-character specials (down+attack, taunts, etc.)
- Additional stages / hazards
- Online play

Made with a bunch of stick-figure flip-book sketches and a lot of knockback-tuning. Have fun!

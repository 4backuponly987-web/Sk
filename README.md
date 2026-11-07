# SKYLINE — iPhone / GitHub Pages build

This repo is ready to host as a GitHub Pages site. The game remains desktop-compatible, but on touch-first phones it switches to the dedicated iPhone flight controls.

## iPhone controls

- **Left thumb vertical pad:** up = dive, down = pull up / flare.
- **Tilt iPhone left/right:** bank and steer. The first launch asks for motion permission and calibrates the current phone angle as neutral.
- **Tuck:** hold while the wings are out. If the wings are stowed, tapping the same button deploys them.
- **Barrel Roll:** rolls in the current tilt direction; near neutral it uses the last steering direction.
- **Parachute:** top-left. It only deploys the canopy; it does not act as a cut-away button.
- **Pause:** top-right. The pause menu also contains tilt calibration, steering sensitivity, left-thumb sensitivity, camera distance and reverse-steering controls.
- **Tight carve:** while flying, touch and hold any empty part of the screen while tilting. This mirrors the desktop left-click hard-turn control. Release to return to normal steering. Touches on actual buttons, sliders and menus are ignored.

The mobile build deliberately removes other trick inputs, inverted flight and respawn-point controls. Free Fly uses an airborne hot start because the mobile layout intentionally has no jump/step-off button. Races already begin airborne.

## Put it on GitHub Pages

1. Create a new GitHub repository.
2. Upload **all files and the `icons` folder** from this repo to the repository root.
3. In GitHub open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`, then save.
6. Open the GitHub Pages HTTPS address in Safari on the iPhone.
7. Tap **Share → Add to Home Screen** and enable **Open as Web App** if Safari shows that option.
8. Open SKYLINE from the Home Screen, press **Enable tilt + calibrate**, and allow motion access.

## Offline use

`service-worker.js` caches the complete game, mobile controls, manifest and icons. After the Pages site has loaded successfully online once and the service worker has installed, the Home Screen app can launch with no connection / in Airplane Mode.

If you publish a new build later, update the `CACHE` name in `service-worker.js` (for example `skyline-iphone-v3`) so existing installations refresh cleanly.

## Important

Motion sensors are only exposed in a secure context. GitHub Pages uses HTTPS, so the deployed version meets that requirement. Opening `index.html` directly from the iPhone Files app is **not** equivalent to the GitHub Pages version and will not provide the full PWA/offline install behavior.


## Mobile control tuning

Open **Pause** while flying to adjust **Tilt sensitivity** and **Left-thumb sensitivity** independently. Both settings are saved locally on the iPhone. You can also recalibrate the neutral tilt angle or reverse the tilt direction if you deliberately prefer the opposite mapping.

## v3.1 touch hardening

This branch is based directly on the v3 Tight Carve build. It disables text/image selection, iOS long-press callouts, browser drag behaviour, double-tap zoom and iOS pinch/gesture zoom while preserving the game's normal multi-touch controls.


## v3.2 camera distance

Pause → Mobile flight now includes **Camera distance**. It changes the real chase-camera stand-off live from **1.0 m (very close)** to **11.5 m (far)**, with **7.6 m** as the original/default view. The setting is stored locally and restored on later launches.


## v3.3 camera distance

Camera distance can now be reduced all the way to **1.0 m** for a much tighter chase view. The original/default view remains **7.6 m** and the far limit remains **11.5 m**.


## v3.4 gesture controls
- Tilt iPhone left/right to steer.
- Touch anywhere on the **left half**; that touch point becomes pitch-neutral. Drag up to dive and down to pull up, then release to return to neutral.
- Hold unused space on the **right half** for Tight Carve.
- Make a quick horizontal swipe on the right half to barrel roll in the swipe direction. The swipe cancels Tight Carve so the two gestures do not fight.
- Tuck / Deploy Wings remains a dedicated hold/tap button; Parachute and Pause remain at the top corners.
- Camera distance still ranges from 1.0 m to 11.5 m.


## v3.5 mobile control + HUD cleanup
- Bottom-right sector is now the invisible Tuck / Deploy Wings control; no Tuck button.
- Right-half hold/swipe remains Tight Carve / barrel roll outside the Tuck sector.
- Parachute is a compact icon button.
- Mobile chase FOV is capped at 76° so high-speed/tucked/race flight does not zoom the pilot so far away.
- Phone HUD is reduced to speed (bottom-left), compact rock proximity (bottom-centre), altitude + AGL (bottom-right), plus essential race timing/ring info.
- The attitude/crosshair display and extra flight stats are hidden on iPhone.
- Title and overlay menus are compressed/scroll-safe for short landscape iPhone screens.

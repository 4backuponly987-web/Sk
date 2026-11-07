(() => {
  'use strict';

  const isTouch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  if (!isTouch) return;

  document.body.classList.add('skyline-mobile');

  // v3.5 — stop Safari from treating gameplay gestures like webpage gestures.
  // We intentionally do NOT cancel ordinary multi-touch/pointer input because
  // the game still needs simultaneous controls such as Tuck + Tight Carve.
  const stopBrowserGesture = (e) => { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) =>
    document.addEventListener(type, stopBrowserGesture, { passive: false })
  );
  document.addEventListener('dblclick', stopBrowserGesture, { passive: false });
  document.addEventListener('selectstart', stopBrowserGesture, { passive: false });
  document.addEventListener('dragstart', stopBrowserGesture, { passive: false });
  document.addEventListener('contextmenu', stopBrowserGesture, { passive: false });


  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const storeKey = 'skyline.mobile.controls.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (_) {}

  const mobile = window.SKYLINE_MOBILE = {
    active: true,
    motionGranted: false,
    motionSeen: false,
    pitch: 0,
    roll: 0,
    rawRoll: 0,
    neutralRoll: null,
    lastDirection: 1,
    sensitivity: clamp(Number(saved.sensitivity) || 1, 0.55, 1.8),
    pitchSensitivity: clamp(Number(saved.pitchSensitivity) || 1, 0.55, 1.8),
    cameraDistance: clamp(Number(saved.cameraDistance) || 7.6, 1.0, 11.5),
    reverse: !!saved.reverse,
    tuck: false,
    tightTurn: false,
    tightTurnPointer: null,
    game: null,
  };

  function persist() {
    try { localStorage.setItem(storeKey, JSON.stringify({ sensitivity: mobile.sensitivity, pitchSensitivity: mobile.pitchSensitivity, cameraDistance: mobile.cameraDistance, reverse: mobile.reverse })); } catch (_) {}
  }

  const controls = document.createElement('div');
  controls.id = 'mobileFlightControls';
  controls.innerHTML = `
    <button id="mobileParachute" class="mobile-action mobile-icon-action" aria-label="Deploy parachute" title="Deploy parachute">🪂</button>
    <button id="mobilePause" class="mobile-action" aria-label="Pause">Pause</button>
    <div id="mobileTiltReadout">Tilt to steer · <b id="mobileTiltValue">0%</b></div>
    <div id="mobilePitchGhost" aria-hidden="true"><div id="mobilePitchGhostKnob"></div></div>
    <div id="mobileGestureHint">LEFT: DRAG ↕ PITCH &nbsp; · &nbsp; RIGHT: HOLD CARVE / SWIPE ↔ ROLL &nbsp; · &nbsp; BOTTOM-RIGHT: HOLD TUCK</div>
    <div id="mobileTuckFeedback" aria-hidden="true">TUCK</div>`;
  document.body.appendChild(controls);

  const setup = document.createElement('div');
  setup.id = 'mobileMotionSetup';
  setup.className = 'open';
  setup.innerHTML = `
    <div class="motion-card">
      <h2>Motion controls</h2>
      <p>Hold your iPhone in <b>landscape</b> in a comfortable neutral position. Tilt the phone left and right to steer.</p>
      <div class="motion-diagram">← TILT LEFT &nbsp; · &nbsp; LEVEL &nbsp; · &nbsp; TILT RIGHT →</div>
      <p><b>Left half:</b> touch anywhere, then drag up/down for dive / pull-up. <b>Right half:</b> hold for Tight Carve, or swipe left/right for a barrel roll. <b>Bottom-right sector:</b> hold anywhere to tuck; if your wings are stowed, touch there once to deploy them.</p>
      <button id="enableMotion">Enable tilt + calibrate</button>
      <p id="mobileMotionStatus">GitHub Pages uses HTTPS, which is required for iPhone motion sensors.</p>
    </div>`;
  document.body.appendChild(setup);

  const rotate = document.createElement('div');
  rotate.id = 'mobileRotateHint';
  rotate.innerHTML = '<div><b>Rotate iPhone</b>SKYLINE mobile is designed for landscape play.</div>';
  document.body.appendChild(rotate);

  const pitchGhost = document.getElementById('mobilePitchGhost');
  const pitchGhostKnob = document.getElementById('mobilePitchGhostKnob');
  const tuckFeedback = document.getElementById('mobileTuckFeedback');
  const chuteBtn = document.getElementById('mobileParachute');
  const pauseBtn = document.getElementById('mobilePause');
  const tiltValue = document.getElementById('mobileTiltValue');
  const enableMotion = document.getElementById('enableMotion');
  const motionStatus = document.getElementById('mobileMotionStatus');

  function orientationAngle() {
    let a = 0;
    if (screen.orientation && Number.isFinite(screen.orientation.angle)) a = screen.orientation.angle;
    else if (Number.isFinite(window.orientation)) a = Number(window.orientation);
    if (a > 180) a -= 360;
    return a;
  }

  // Convert the natural device beta/gamma axes into left/right tilt relative
  // to the CURRENT screen orientation. This keeps steering correct in either
  // landscape direction.
  function screenRoll(beta, gamma) {
    const theta = orientationAngle() * Math.PI / 180;
    return gamma * Math.cos(theta) - beta * Math.sin(theta);
  }

  function handleOrientation(e) {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    mobile.motionSeen = true;
    const raw = screenRoll(e.beta, e.gamma);
    mobile.rawRoll = raw;
    if (mobile.neutralRoll === null) mobile.neutralRoll = raw;
    // iPhone landscape sensor sign is opposite the game's roll convention.
    // Negating here makes the physical gesture intuitive by default:
    // tilt phone LEFT -> pilot banks/steers LEFT, and vice versa.
    let d = -(raw - mobile.neutralRoll);
    if (mobile.reverse) d *= -1;
    const dead = 2.2;
    const full = 23 / mobile.sensitivity;
    const mag = Math.abs(d);
    let target = 0;
    if (mag > dead) {
      const t = clamp((mag - dead) / Math.max(1, full - dead), 0, 1);
      target = Math.sign(d) * Math.pow(t, 1.15);
    }
    mobile.roll += (target - mobile.roll) * 0.24;
    if (Math.abs(mobile.roll) > 0.12) mobile.lastDirection = mobile.roll > 0 ? 1 : -1;
    tiltValue.textContent = `${Math.round(mobile.roll * 100)}%`;
  }

  window.addEventListener('deviceorientation', handleOrientation, true);

  function calibrate() {
    mobile.neutralRoll = mobile.rawRoll;
    mobile.roll = 0;
    tiltValue.textContent = '0%';
    if (mobile.game?.hud) mobile.game.hud.toast('TILT CALIBRATED', 1600);
  }

  async function requestMotion() {
    motionStatus.textContent = 'Requesting motion access…';
    try {
      if (!window.DeviceOrientationEvent) throw new Error('This browser does not expose device orientation sensors.');
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') throw new Error('Motion permission was not granted.');
      }
      mobile.motionGranted = true;
      mobile.neutralRoll = null;
      try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
      motionStatus.textContent = 'Tilt enabled. Hold the phone still for calibration…';
      setTimeout(() => {
        calibrate();
        setup.classList.remove('open');
      }, 420);
    } catch (err) {
      motionStatus.textContent = err?.message || 'Could not enable motion controls.';
    }
  }
  enableMotion.addEventListener('click', requestMotion);

  function updateOrientationClass() {
    const portrait = innerHeight > innerWidth;
    document.body.classList.toggle('mobile-portrait', portrait);
    if (!portrait && mobile.motionGranted) setTimeout(calibrate, 180);
  }
  addEventListener('resize', updateOrientationClass);
  screen.orientation?.addEventListener?.('change', updateOrientationClass);
  updateOrientationClass();

  // ----- spatial iPhone flight gestures -----------------------------------
  // Left half: touch anywhere; the touch-down point becomes neutral pitch.
  // Drag up to dive, down to pull up. Releasing returns pitch to neutral.
  //
  // Right half: hold anywhere unused for Tight Carve. A quick, deliberate
  // horizontal swipe cancels the carve and fires a barrel roll in the swipe
  // direction. This removes the need to hunt for a Barrel Roll button.
  const gestureInteractive = [
    'button', 'input', 'select', 'textarea', 'a',
    '#mobileParachute', '#mobilePause',
    '#mobileMotionSetup', '#mobileRotateHint', '.overlay', '.panel', '.pill', '.btn'
  ].join(',');

  let pitchPointer = null;
  let pitchStartX = 0;
  let pitchStartY = 0;
  let rightGesture = null;
  let tuckPointer = null;

  function gameplayGestureTargetOK(e) {
    const g = mobile.game;
    if (!g || g.mode !== 'fly' || g.paused || g.ui?.stack?.length) return false;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest?.(gestureInteractive)) return false;
    return true;
  }

  function showPitchGhost(x, y, dy = 0) {
    pitchGhost.style.left = `${x}px`;
    pitchGhost.style.top = `${y}px`;
    pitchGhost.style.opacity = '1';
    pitchGhostKnob.style.transform = `translate(-50%, calc(-50% + ${dy}px))`;
  }

  function setPitchFromDrag(y) {
    // Short enough for fast race corrections, long enough for fine control.
    const travel = clamp(innerHeight * 0.34, 82, 150);
    const dy = clamp(y - pitchStartY, -travel, travel);
    // Up = negative pitch (dive), down = positive pitch (pull up).
    mobile.pitch = clamp((dy / travel) * mobile.pitchSensitivity, -1, 1);
    showPitchGhost(pitchStartX, pitchStartY, dy);
  }

  function releasePitchGesture(pointerId = null) {
    if (pitchPointer === null) return;
    if (pointerId !== null && pointerId !== pitchPointer) return;
    pitchPointer = null;
    mobile.pitch = 0;
    pitchGhost.style.opacity = '0';
    pitchGhostKnob.style.transform = 'translate(-50%, -50%)';
  }

  function setTightCarve(on, pointerId = null) {
    mobile.tightTurn = !!on;
    mobile.tightTurnPointer = on ? pointerId : null;
    document.body.classList.toggle('mobile-tight-turn', !!on);
  }

  function triggerBarrelRoll(dir) {
    const g = mobile.game;
    if (!g || g.mode !== 'fly' || g.paused || !g.input) return;
    const action = dir > 0 ? 'rollTrickR' : 'rollTrickL';
    g.input.pressed[action] = true;
    mobile.lastDirection = dir > 0 ? 1 : -1;
    document.body.classList.remove('mobile-tight-turn');
    document.body.classList.add(dir > 0 ? 'mobile-roll-right' : 'mobile-roll-left');
    setTimeout(() => document.body.classList.remove('mobile-roll-right', 'mobile-roll-left'), 260);
    if (navigator.vibrate) navigator.vibrate([8, 18, 8]);
  }

  function inTuckZone(x, y) {
    // Large ergonomic corner sector: easy to hit without looking, but leaves
    // the upper-right half free for Tight Carve / barrel-roll gestures.
    return x >= innerWidth * 0.66 && y >= innerHeight * 0.58;
  }

  function beginTuckGesture(e) {
    const g = mobile.game;
    const p = g?.pilot;
    if (!g || !p || p.state === 'ground' || p.state === 'canopy') return false;
    tuckPointer = e.pointerId;
    // Preserve the old dual-purpose behaviour: if the wings are stowed, this
    // corner deploys them first rather than immediately re-tucking them.
    if (p.wingsTarget < 0.5 || p.wings < 0.35) {
      if (p.toggleWings?.()) g.hud?.toast('WINGS OUT', 900);
      mobile.tuck = false;
      tuckFeedback.textContent = 'WINGS OUT';
    } else {
      mobile.tuck = true;
      tuckFeedback.textContent = 'TUCK';
    }
    tuckFeedback.classList.add('show');
    if (navigator.vibrate) navigator.vibrate(5);
    return true;
  }

  function releaseTuckGesture(pointerId = null) {
    if (tuckPointer === null) return;
    if (pointerId !== null && pointerId !== tuckPointer) return;
    tuckPointer = null;
    mobile.tuck = false;
    tuckFeedback.classList.remove('show');
  }

  window.addEventListener('pointerdown', (e) => {
    if (!gameplayGestureTargetOK(e)) return;
    const g = mobile.game;
    const leftHalf = e.clientX < innerWidth * 0.5;

    if (leftHalf) {
      // Pitch remains useful under canopy too (track / flare mapping).
      if (pitchPointer !== null) return;
      pitchPointer = e.pointerId;
      pitchStartX = e.clientX;
      pitchStartY = e.clientY;
      mobile.pitch = 0;
      showPitchGhost(pitchStartX, pitchStartY, 0);
      e.preventDefault();
      return;
    }

    // The bottom-right sector is a dedicated invisible Tuck control.
    if (inTuckZone(e.clientX, e.clientY)) {
      if (tuckPointer === null && beginTuckGesture(e)) e.preventDefault();
      return;
    }

    // The rest of the right half remains Tight Carve / barrel-roll space.
    if (g.pilot?.state === 'ground' || g.pilot?.state === 'canopy' || rightGesture) return;
    rightGesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), rolled: false };
    setTightCarve(true, e.pointerId);
    if (navigator.vibrate) navigator.vibrate(6);
    e.preventDefault();
  }, { capture: true, passive: false });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerId === pitchPointer) {
      setPitchFromDrag(e.clientY);
      e.preventDefault();
      return;
    }
    if (!rightGesture || e.pointerId !== rightGesture.id || rightGesture.rolled) return;

    const dx = e.clientX - rightGesture.x;
    const dy = e.clientY - rightGesture.y;
    const elapsed = performance.now() - rightGesture.t;
    // A quick, clearly horizontal gesture is a roll. After ~0.45 s the same
    // finger is considered a carve hold, so normal hand drift cannot roll you.
    if (elapsed <= 450 && Math.abs(dx) >= 68 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      rightGesture.rolled = true;
      setTightCarve(false);
      triggerBarrelRoll(dx > 0 ? 1 : -1);
      e.preventDefault();
    }
  }, { capture: true, passive: false });

  function releaseSpatialGesture(e) {
    if (!e) {
      releasePitchGesture();
      releaseTuckGesture();
      rightGesture = null;
      setTightCarve(false);
      return;
    }
    if (e.pointerId === pitchPointer) releasePitchGesture(e.pointerId);
    if (e.pointerId === tuckPointer) releaseTuckGesture(e.pointerId);
    if (rightGesture && e.pointerId === rightGesture.id) {
      rightGesture = null;
      setTightCarve(false);
    }
  }
  window.addEventListener('pointerup', releaseSpatialGesture, true);
  window.addEventListener('pointercancel', releaseSpatialGesture, true);
  window.addEventListener('blur', () => releaseSpatialGesture(null));

  // ----- parachute / pause -------------------------------------------------
  chuteBtn.addEventListener('click', (e) => {
    const g = mobile.game;
    const p = g?.pilot;
    if (!g || g.mode !== 'fly' || g.paused || !p) return;
    // Mobile has a deploy button, not a cut-away button.
    if (p.state !== 'canopy') p.deployCanopy?.();
    e.preventDefault();
  });

  pauseBtn.addEventListener('click', (e) => {
    const g = mobile.game;
    if (!g?.ui) return;
    if (g.ui.stack?.length) g.ui.close();
    else if (g.mode === 'fly') g.ui.openPause();
    e.preventDefault();
  });

  function addMobilePauseControls(g) {
    const overlay = g.ui?.stack?.[g.ui.stack.length - 1];
    const panel = overlay?.querySelector('.panel');
    if (!panel || panel.querySelector('.mobile-pause-controls')) return;
    const box = document.createElement('div');
    box.className = 'mobile-pause-controls';
    box.innerHTML = `
      <h3>Mobile flight</h3>
      <div class="row"><label>Tilt sensitivity</label><input class="mobile-sens" type="range" min="0.55" max="1.8" step="0.05" value="${mobile.sensitivity}"><span class="val mobile-sens-val">${mobile.sensitivity.toFixed(2)}×</span></div>
      <div class="row"><label>Pitch drag sensitivity</label><input class="mobile-pitch-sens" type="range" min="0.55" max="1.8" step="0.05" value="${mobile.pitchSensitivity}"><span class="val mobile-pitch-sens-val">${mobile.pitchSensitivity.toFixed(2)}×</span></div>
      <div class="row"><label>Camera distance</label><input class="mobile-camera-distance" type="range" min="1.0" max="11.5" step="0.1" value="${mobile.cameraDistance}"><span class="val mobile-camera-distance-val">${mobile.cameraDistance.toFixed(1)} m</span></div>
      <div class="btnrow"><button class="btn mobile-cal">Recalibrate tilt</button><button class="btn mobile-reverse">Tilt direction: ${mobile.reverse ? 'Reversed' : 'Normal'}</button></div>`;
    const firstH3 = panel.querySelector('h3');
    if (firstH3) panel.insertBefore(box, firstH3);
    else panel.appendChild(box);
    const range = box.querySelector('.mobile-sens');
    const val = box.querySelector('.mobile-sens-val');
    const pitchRange = box.querySelector('.mobile-pitch-sens');
    const pitchVal = box.querySelector('.mobile-pitch-sens-val');
    const cameraRange = box.querySelector('.mobile-camera-distance');
    const cameraVal = box.querySelector('.mobile-camera-distance-val');
    range.oninput = () => { mobile.sensitivity = Number(range.value); val.textContent = `${mobile.sensitivity.toFixed(2)}×`; persist(); };
    pitchRange.oninput = () => { mobile.pitchSensitivity = Number(pitchRange.value); pitchVal.textContent = `${mobile.pitchSensitivity.toFixed(2)}×`; persist(); };
    cameraRange.oninput = () => {
      mobile.cameraDistance = clamp(Number(cameraRange.value), 1.0, 11.5);
      cameraVal.textContent = `${mobile.cameraDistance.toFixed(1)} m`;
      if (g.camRig) g.camRig.distance = mobile.cameraDistance;
      persist();
    };
    box.querySelector('.mobile-cal').onclick = calibrate;
    box.querySelector('.mobile-reverse').onclick = (ev) => {
      mobile.reverse = !mobile.reverse;
      ev.currentTarget.textContent = `Tilt direction: ${mobile.reverse ? 'Reversed' : 'Normal'}`;
      persist();
      calibrate();
    };
  }

  function installGameHooks(g) {
    if (g.__mobileHooksInstalled) return;
    g.__mobileHooksInstalled = true;
    mobile.game = g;
    // Camera distance is a true chase-camera stand-off, not a FOV zoom.
    // Apply the saved value as soon as the game object is available.
    if (g.camRig) g.camRig.distance = mobile.cameraDistance;

    // The desktop camera widens from about 62° to 100° as speed rises. On an
    // iPhone that makes the pilot become tiny exactly when tucking/racing.
    // Keep some speed sensation, but cap the mobile chase FOV at 76°.
    if (g.camRig?.update && !g.camRig.__mobileFovClamp) {
      g.camRig.__mobileFovClamp = true;
      const originalCamUpdate = g.camRig.update.bind(g.camRig);
      g.camRig.update = function(dt, p, opts) {
        const result = originalCamUpdate(dt, p, opts);
        if (this.mode === 'chase' && this.camera?.fov > 76) {
          this.fov = Math.min(this.fov, 76);
          this.targetFov = Math.min(this.targetFov, 76);
          this.camera.fov = 76;
          this.camera.updateProjectionMatrix();
        }
        return result;
      };
    }

    // Free Fly on desktop begins standing on a cliff and requires Space to
    // step off. Mobile intentionally has no jump button, so Fly starts hot.
    if (g.ui?.titleAction) {
      const originalTitleAction = g.ui.titleAction.bind(g.ui);
      g.ui.titleAction = function(act) {
        if (act === 'fly') {
          document.getElementById('title')?.classList.add('hidden');
          g.launch(g.startPoi, 'hot');
          return;
        }
        if (act === 'tutorial') return; // keyboard tutorial is intentionally omitted on mobile
        return originalTitleAction(act);
      };
    }

    // Apply the two analogue mobile axes after the game's desktop/gamepad
    // input has been built. This keeps desktop support intact in the repo.
    const originalBuildInput = g.buildInput.bind(g);
    g.buildInput = function() {
      const out = originalBuildInput();
      if (g.mode !== 'fly' || g.paused) return out;
      if (g.pilot?.state === 'ground') {
        // No ground movement controls on mobile; mobile launches are airborne.
        out.walkF = 0; out.walkS = 0; out.run = false; out.jump = false;
        return out;
      }
      if (g.pilot?.state === 'canopy') {
        out.roll = mobile.roll;
        out.yaw = mobile.roll * 0.5;
        out.track = mobile.pitch < -0.18 ? Math.abs(mobile.pitch) : 0;
        out.flare = mobile.pitch > 0.18 ? mobile.pitch : 0;
        return out;
      }
      out.pitch = mobile.pitch;
      out.roll = mobile.roll;
      out.yaw = 0;
      out.tuck = mobile.tuck ? 1 : 0;
      out.track = 0;
      out.flare = 0;
      // Hold unused screen space while steering to mirror desktop Mouse0:
      // the carve gets extra bank authority and automatically adds the pull
      // needed to bend the flight path instead of simply dropping altitude.
      const tightCarve = mobile.tightTurn && Math.abs(mobile.roll) > 0.055;
      if (tightCarve) out.pitch = Math.max(out.pitch, 0.9);
      out.hardPull = tightCarve;
      out.hardTurn = tightCarve;
      g._lastRoll = mobile.roll;
      return out;
    };

    // Mobile deliberately exposes only barrel roll. Filter all other trick
    // inputs so an attached keyboard cannot accidentally enable invert/flips.
    if (g.tricks?.update) {
      const originalTrickUpdate = g.tricks.update.bind(g.tricks);
      const blocked = ['flipMod','heliMod','corkscrew','invert','frontFlip','backFlip'];
      g.tricks.update = function(dt, inp, ed, pilot) {
        const safeInp = Object.assign({}, inp);
        const safeEd = Object.assign({}, ed);
        blocked.forEach((k) => { safeInp[k] = false; safeEd[k] = false; });
        return originalTrickUpdate(dt, safeInp, safeEd, pilot);
      };
    }

    // No respawn-point mechanic on iPhone. A retry restarts the current run/race.
    const originalSetSpawn = g.setSpawnHere?.bind(g);
    g.setSpawnHere = function() { return undefined; };
    g.respawn = function() { return g.retry(); };
    void originalSetSpawn;

    // Map: keep the existing map/races, but remove the unusable cliff start
    // and respawn-point list. Hot start remains the default mobile launch.
    if (g.ui?.refreshMapSide) {
      const originalRefreshMap = g.ui.refreshMapSide.bind(g.ui);
      g.ui.refreshMapSide = function() {
        this.launchMode = this.launchMode === 'heli' ? 'heli' : 'hot';
        originalRefreshMap();
        const side = this.mapSide;
        if (!side) return;
        [...side.querySelectorAll('.pill')].forEach((b) => {
          if (/Cliff jump/i.test(b.textContent || '')) b.remove();
        });
        const headings = [...side.querySelectorAll('h3')];
        const respawnHead = headings.find((h) => /^Respawn points/i.test(h.textContent || ''));
        if (respawnHead) {
          let n = respawnHead;
          while (n) { const next = n.nextSibling; n.remove(); n = next; }
        }
      };
    }

    // Pause menu gains calibration/sensitivity settings without adding another
    // in-flight button.
    if (g.ui?.openPause) {
      const originalPause = g.ui.openPause.bind(g.ui);
      g.ui.openPause = function() {
        originalPause();
        addMobilePauseControls(g);
      };
    }

    if (g.hud) g.hud.toast('IPHONE CONTROLS READY', 1800);
  }

  function updateUI() {
    const g = mobile.game;
    const live = !!(g && g.mode === 'fly' && !g.paused && !(g.ui?.stack?.length));
    controls.classList.toggle('live', live);
    controls.style.visibility = live ? 'visible' : 'hidden';
    if (!live) releaseSpatialGesture(null);
    if (g?.pilot) {
      chuteBtn.disabled = g.pilot.state === 'canopy';
      chuteBtn.textContent = '🪂';
      chuteBtn.setAttribute('aria-label', g.pilot.state === 'canopy' ? 'Parachute deployed' : 'Deploy parachute');
    }
    requestAnimationFrame(updateUI);
  }
  requestAnimationFrame(updateUI);

  function waitForGame() {
    const g = window.SKYLINE;
    if (g && g.ui && g.pilot && g.tricks) installGameHooks(g);
    else setTimeout(waitForGame, 80);
  }
  waitForGame();

  // Offline/online feedback once the game itself exists.
  addEventListener('offline', () => mobile.game?.hud?.toast('OFFLINE MODE', 1800));
  addEventListener('online', () => mobile.game?.hud?.toast('ONLINE', 1200));
})();

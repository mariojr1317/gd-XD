/* Geometry Dash 2.2 Swing compatibility layer. */
(() => {
  if (window.__gd22SwingCompatLoaded) return;
  window.__gd22SwingCompatLoaded = true;

  const SWING_PORTAL_ID = 1933;
  const SWING_GRAVITY = 0.36;
  const SWING_MAX_VELOCITY = 13;
  const SWING_ANIM_DISTANCE = 12;
  const SWING_ANIM_DURATION = 0.18;
  const SWING_ANIM_ROTATION = Math.PI;

  function getSourceLevelObject(player, collider) {
    const id = collider?._eeObjectId;
    if (id === undefined || id === null) return null;
    const layer = player?._gameLayer;
    return layer?._resetobject?.[id] || layer?._resetObject?.[id] || null;
  }

  function isSwingCollider(player, collider) {
    if (!collider) return false;
    if (String(collider.type || '').toLowerCase() === 'portal_swing') return true;
    const source = getSourceLevelObject(player, collider);
    return Number(source?.id) === SWING_PORTAL_ID || String(source?.sub || '').toLowerCase() === 'swing';
  }

  function touchesPortal(player, collider, worldX) {
    const size = player.p?.isMini ? 18 : 30;
    if (!Number.isFinite(Number(worldX)) || !Number.isFinite(Number(player.p?.y))) return false;
    return typeof player._isPlayerTouchingPortalHitbox === 'function'
      ? player._isPlayerTouchingPortalHitbox(collider, Number(worldX), Number(player.p.y), size)
      : false;
  }

  function tintSwingLayers(player) {
    const primary = Number(window.mainColor) || 0xffffff;
    const secondary = Number(window.secondaryColor) || 0xffffff;
    if (player._swingBase?.setTint) player._swingBase.setTint(primary);
    if (player._swingOverlay?.setTint) player._swingOverlay.setTint(secondary);
    if (player._swingExtra?.setTint) player._swingExtra.setTint(primary);
    if (player._swingGlow?.setTint) player._swingGlow.setTint(secondary);
    if (player._swingSprite?.setTint) player._swingSprite.setTint(primary);
  }

  function makeSwingSprite(player) {
    if (player._swingSprite || !player._scene) return;
    const scene = player._scene;
    const candidates = [
      ['swing_01_001.png', 'base'],
      ['swing_01_2_001.png', 'overlay'],
      ['swing_01_extra_001.png', 'extra'],
      ['swing_01_glow_001.png', 'glow']
    ];
    for (const [frame, kind] of candidates) {
      try {
        if (typeof getAtlasFrame !== 'function') continue;
        const data = getAtlasFrame(scene, frame);
        if (!data) continue;
        const spr = scene.add.image(0, 0, data.atlas, data.frame);
        spr.setOrigin(0.5, 0.5);
        spr.setDepth(kind === 'glow' ? 11.9 : kind === 'overlay' ? 12.1 : 12);
        spr.setVisible(false);
        if (kind === 'base') player._swingBase = spr;
        else if (kind === 'overlay') player._swingOverlay = spr;
        else if (kind === 'extra') player._swingExtra = spr;
        else if (kind === 'glow') player._swingGlow = spr;
      } catch (_) {}
    }
    player._swingSprite = player._swingBase || null;
    player._swingAnimOffset = 0;
    player._swingAnimRotation = 0;
    player._swingAnimProgress = 1;
    player._swingAnimActive = false;
    tintSwingLayers(player);
  }

  function setSwingVisible(player, visible) {
    makeSwingSprite(player);
    const layers = [player._swingGlow, player._swingBase, player._swingOverlay, player._swingExtra];
    for (const spr of layers) if (spr) spr.setVisible(!!visible);
    if (visible) tintSwingLayers(player);
    if (player._swingSprite) player._swingSprite.setScale(player.p?.isMini ? 0.6 : 1);
  }

  function syncSwingCeiling(player) {
    const scene = player?._scene;
    const layer = player?._gameLayer;
    if (!scene || !layer || !player?.p?.isSwing) return;
    const ceiling = Number(layer.getCeilingY?.());
    if (!Number.isFinite(ceiling)) return;

    if (!player._swingCeilingGuide) {
      player._swingCeilingGuide = scene.add.graphics();
      player._swingCeilingGuide.setScrollFactor(0);
      player._swingCeilingGuide.setDepth(100);
    }

    const size = player.p.isMini ? 18 : 30;
    // This graphics object uses screen coordinates (scroll factor 0), so
    // cameraY must NOT be added. Ship/Fly collision still uses the same
    // world-space ceiling value.
    const screenY = b(ceiling - size);
    const width = typeof screenWidth === 'number' ? screenWidth : 1200;

    player._swingCeilingGuide.clear();
    player._swingCeilingGuide.lineStyle(6, 0xffffff, 0.8);
    player._swingCeilingGuide.beginPath();
    player._swingCeilingGuide.moveTo(0, screenY);
    player._swingCeilingGuide.lineTo(width, screenY);
    player._swingCeilingGuide.strokePath();
    player._swingCeilingGuide.setVisible(true);
  }

  function syncSwingSprite(player) {
    if (!player?.p?.isSwing) return;
    makeSwingSprite(player);
    if (!player._swingBase) return;

    const x = player.p.mirrored
      ? (typeof screenWidth === 'number' ? screenWidth - centerX : centerX)
      : centerX;
    const baseY = Number.isFinite(player._lastScreenY) ? player._lastScreenY : b(player.p.y);
    const gravityDirection = player.p.gravityFlipped ? -1 : 1;
    const offset = Number(player._swingAnimOffset) || 0;
    const animationRotation = Number(player._swingAnimRotation) || 0;
    const y = baseY + offset * gravityDirection;
    const mini = player.p.isMini ? 0.6 : 1;
    const layers = [player._swingGlow, player._swingBase, player._swingOverlay, player._swingExtra];

    for (const spr of layers) {
      if (!spr) continue;
      spr.x = x;
      spr.y = y;
      spr.rotation = animationRotation;
      spr.scaleX = player.p.mirrored ? -mini : mini;
      spr.scaleY = mini;
      spr.setVisible(true);
    }
    tintSwingLayers(player);
    syncSwingCeiling(player);
  }

  function startSwingAnimation(player) {
    if (!player?.p?.isSwing) return;
    // Animation starts only from an actual Swing click.
    player._swingAnimOffset = 0;
    player._swingAnimRotation = 0;
    player._swingAnimProgress = 0;
    player._swingAnimActive = true;
  }

  function updateSwingAnimation(player, dt) {
    if (!player?.p?.isSwing || !player._swingAnimActive) return;
    const frame = Math.max(0, Number(dt) || 0);
    const duration = Math.max(0.001, SWING_ANIM_DURATION);
    player._swingAnimProgress = Math.min(1, (Number(player._swingAnimProgress) || 0) + frame / duration);

    // Smooth ease-out: the Swing moves vertically toward the new gravity side.
    const t = player._swingAnimProgress;
    const eased = 1 - Math.pow(1 - t, 3);
    player._swingAnimOffset = eased * SWING_ANIM_DISTANCE;
    player._swingAnimRotation = eased * SWING_ANIM_ROTATION;

    if (t >= 1) {
      player._swingAnimOffset = 0;
      player._swingAnimRotation = SWING_ANIM_ROTATION;
      player._swingAnimActive = false;
    }
  }

  function clampSwingToBounds(player) {
    if (!player?.p?.isSwing) return;
    const floor = Number(player._gameLayer?.getFloorY?.());
    const ceiling = Number(player._gameLayer?.getCeilingY?.());
    if (!Number.isFinite(floor) || !Number.isFinite(ceiling)) return;

    // Swing uses exactly the same vertical limits as Ship/Fly.
    // The player's center stays one player-size away from each boundary.
    const size = player.p.isMini ? 18 : 30;
    const minY = floor + size;
    const maxY = ceiling - size;
    if (minY > maxY) return;

    if (player.p.y < minY) {
      player.p.y = minY;
      player.p.yVelocity = 0;
      player.p.onGround = true;
      player.p.onCeiling = false;
    } else if (player.p.y > maxY) {
      player.p.y = maxY;
      player.p.yVelocity = 0;
      player.p.onGround = false;
      player.p.onCeiling = true;
    }
  }

  function enterSwing(player) {
    if (!player?.p || player.p.isSwing) return;
    const gravityAtEntry = !!player.p.gravityFlipped;
    player.exitSpiderMode?.();
    player.exitRobotMode?.();
    player.exitBallMode?.();
    player.exitWaveMode?.();
    player.exitShipMode?.();
    player.exitUfoMode?.();
    player.p.isSwing = true;
    player.p.isFlying = false;
    player.p.isUfo = false;
    player.p.isBall = false;
    player.p.isWave = false;
    player.p.isSpider = false;
    player.p.isRobot = false;
    player.p.gravityFlipped = gravityAtEntry;
    player.p.yVelocity = 0;
    player.p.onGround = false;
    player.p.onCeiling = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.upKeyPressed = false;
    player.p.queuedHold = false;
    player.p._orbActivationConsumedForPress = true;
    player._swingAnimOffset = 0;
    player._swingAnimRotation = 0;
    player._swingAnimProgress = 1;
    player._swingAnimActive = false;
    player.stopRotation?.();
    player._rotation = 0;
    player._setGamemodeFlyBounds?.(true, 0);
    player.setCubeVisible(false);
    player.setShipVisible(false);
    player.setBallVisible?.(false);
    player.setWaveVisible?.(false);
    player.setSpiderVisible?.(false);
    player.setRobotVisible?.(false);
    setSwingVisible(player, true);
    clampSwingToBounds(player);
    syncSwingCeiling(player);
  }

  function exitSwing(player) {
    if (!player?.p?.isSwing) return;
    player.p.isSwing = false;
    player._setGamemodeFlyBounds?.(false, 0);
    player.p.onGround = false;
    player.p.onCeiling = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.yVelocity = 0;
    player._swingAnimOffset = 0;
    player._swingAnimRotation = 0;
    player._swingAnimProgress = 1;
    player._swingAnimActive = false;
    setSwingVisible(player, false);
    if (player._swingCeilingGuide) player._swingCeilingGuide.setVisible(false);
    player.setCubeVisible(!player.p.isFlying && !player.p.isWave && !player.p.isUfo && !player.p.isSpider && !player.p.isRobot);
  }

  function swingClick(player) {
    if (!player?.p?.isSwing || player.p.isDead) return;
    player.p.gravityFlipped = !player.p.gravityFlipped;
    player.p.yVelocity = 0;
    player.p.onGround = false;
    player.p.onCeiling = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.upKeyPressed = false;
    player.p.queuedHold = false;
    player.p._orbActivationConsumedForPress = true;
    player.stopRotation?.();
    player._rotation = 0;
    startSwingAnimation(player);
  }

  if (typeof PlayerObject !== 'undefined' && PlayerObject.prototype) {
    PlayerObject.prototype.enterSwingMode = function() { enterSwing(this); };
    PlayerObject.prototype.exitSwingMode = function() { exitSwing(this); };

    // Every real gamemode portal must be allowed to leave Swing.
    // Wrap the mode-entry functions so Swing never remains active alongside another mode.
    const modeEntries = [
      'enterCubeMode', 'enterShipMode', 'enterBallMode',
      'enterWaveMode', 'enterUfoMode', 'enterRobotMode', 'enterSpiderMode'
    ];
    for (const method of modeEntries) {
      const original = PlayerObject.prototype[method];
      if (typeof original === 'function') {
        const flag = '__gd22SwingExit_' + method;
        if (!PlayerObject.prototype[flag]) {
          PlayerObject.prototype[flag] = true;
          PlayerObject.prototype[method] = function(...args) {
            if (this.p?.isSwing) exitSwing(this);
            return original.apply(this, args);
          };
        }
      }
    }

    const originalUpdateJump = PlayerObject.prototype.updateJump;
    if (typeof originalUpdateJump === 'function' && !PlayerObject.prototype.__gd22SwingPhysicsPatched) {
      PlayerObject.prototype.__gd22SwingPhysicsPatched = true;
      PlayerObject.prototype.updateJump = function(dt) {
        if (!this.p?.isSwing) return originalUpdateJump.call(this, dt);
        const frame = Math.max(0, Number(dt) || 0);
        const gravitySign = this.p.gravityFlipped ? -1 : 1;
        const gravityBase = typeof p === 'number' ? p : 1;
        this.p.yVelocity -= gravityBase * SWING_GRAVITY * frame * gravitySign;
        this.p.yVelocity = Math.max(-SWING_MAX_VELOCITY, Math.min(SWING_MAX_VELOCITY, this.p.yVelocity));
        this.p.onGround = false;
        this.p.onCeiling = false;
        this.p.canJump = false;
        this.p.isJumping = false;
        updateSwingAnimation(this, frame);
        clampSwingToBounds(this);
        this._rotation = 0;
      };
    }

    const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
    if (typeof originalCheckCollisions === 'function' && !PlayerObject.prototype.__gd22SwingCollisionPatched) {
      PlayerObject.prototype.__gd22SwingCollisionPatched = true;
      PlayerObject.prototype.checkCollisions = function(...args) {
        let enteredThisFrame = false;
        if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
          const pieceWidth = Number(args[0]) + (typeof centerX === 'number' ? centerX : 0);
          const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];
          for (const obj of nearby) {
            if (!isSwingCollider(this, obj) || !touchesPortal(this, obj, pieceWidth)) continue;
            obj.type = 'portal_swing';
            obj.swingPortal = true;
            if (!this._isObjectActivated?.(obj)) {
              this._setObjectActivated?.(obj, true);
              this._playPortalShine?.(obj);
              enterSwing(this);
              enteredThisFrame = true;
            }
            break;
          }
        }

        // Run the normal collision engine unchanged. It now handles the real
        // Ship/Fly ceiling and every other portal. Swing only supplies its own
        // movement between portal transitions.
        if (enteredThisFrame) {
          this._lastCollisionWorldX = Number(args[0]) + (typeof centerX === 'number' ? centerX : 0);
          this._lastCollisionWorldY = this.p.y;
          return;
        }

        return originalCheckCollisions.apply(this, args);
      };
    }

    const originalSyncSprites = PlayerObject.prototype.syncSprites;
    if (typeof originalSyncSprites === 'function' && !PlayerObject.prototype.__gd22SwingSyncPatched) {
      PlayerObject.prototype.__gd22SwingSyncPatched = true;
      PlayerObject.prototype.syncSprites = function(...args) {
        const result = originalSyncSprites.apply(this, args);
        if (this.p?.isSwing) {
          setSwingVisible(this, true);
          syncSwingSprite(this);
          syncSwingCeiling(this);
          this.setCubeVisible(false);
          this.setShipVisible(false);
          this.setBallVisible?.(false);
          this.setWaveVisible?.(false);
          this.setSpiderVisible?.(false);
          this.setRobotVisible?.(false);
        } else if (this._swingSprite) {
          setSwingVisible(this, false);
          if (this._swingCeilingGuide) this._swingCeilingGuide.setVisible(false);
        }
        return result;
      };
    }
  }

  if (typeof GameScene !== 'undefined' && GameScene.prototype && !GameScene.prototype.__gd22SwingPatched) {
    GameScene.prototype.__gd22SwingPatched = true;
    const originalCreate = GameScene.prototype.create;
    if (typeof originalCreate === 'function') {
      GameScene.prototype.create = function(...args) {
        const result = originalCreate.apply(this, args);
        const scene = this;
        const handlePress = () => {
          if (scene._player?.p?.isSwing) swingClick(scene._player);
          if (scene._player2?.p?.isSwing) swingClick(scene._player2);
        };
        scene.input?.on('pointerdown', handlePress);
        scene.input?.keyboard?.on('keydown-SPACE', handlePress);
        scene.input?.keyboard?.on('keydown-UP', handlePress);
        return result;
      };
    }
  }

  window.gd22Swing = { enter: p => enterSwing(p), exit: p => exitSwing(p), click: p => swingClick(p) };
})();
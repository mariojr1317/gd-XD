/* Geometry Dash 2.2 Swing compatibility layer. */
(() => {
  if (window.__gd22SwingCompatLoaded) return;
  window.__gd22SwingCompatLoaded = true;

  const SWING_PORTAL_ID = 1933;
  const SWING_GRAVITY = 0.36;
  const SWING_MAX_VELOCITY = 13;
  const SWING_ANIM_DISTANCE = 9;
  const SWING_ANIM_SPEED = 7.5;

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
    player._swingAnimTime = 0;
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
    if (!scene || !layer) return;
    const ceiling = Number(layer.getCeilingY?.());
    if (!Number.isFinite(ceiling)) return;
    if (!player._swingCeilingGuide) {
      player._swingCeilingGuide = scene.add.graphics().setScrollFactor(0).setDepth(10);
    }
    const cameraY = Number(scene._cameraY) || 0;
    const screenY = b(ceiling) + cameraY;
    const width = typeof screenWidth === 'number' ? screenWidth : 1200;
    player._swingCeilingGuide.clear();
    player._swingCeilingGuide.lineStyle(4, 0xffffff, 0.35);
    player._swingCeilingGuide.beginPath();
    player._swingCeilingGuide.moveTo(0, screenY);
    player._swingCeilingGuide.lineTo(width, screenY);
    player._swingCeilingGuide.strokePath();
    player._swingCeilingGuide.setVisible(!!player.p?.isSwing);
  }

  function syncSwingSprite(player) {
    if (!player?.p?.isSwing) return;
    makeSwingSprite(player);
    if (!player._swingBase) return;

    const x = player.p.mirrored
      ? (typeof screenWidth === 'number' ? screenWidth - centerX : centerX)
      : centerX;
    const baseY = Number.isFinite(player._lastScreenY) ? player._lastScreenY : b(player.p.y);

    // Visual Swing animation: the craft gently travels up/down around the
    // player's center. It follows the current gravity, independently of the
    // physics position, so the motion stays smooth and does not drift.
    const gravityDirection = player.p.gravityFlipped ? -1 : 1;
    const offset = Number(player._swingAnimOffset) || 0;
    const y = baseY + offset * gravityDirection;
    const mini = player.p.isMini ? 0.6 : 1;
    const layers = [player._swingGlow, player._swingBase, player._swingOverlay, player._swingExtra];

    for (const spr of layers) {
      if (!spr) continue;
      spr.x = x;
      spr.y = y;
      spr.rotation = 0;
      spr.scaleX = player.p.mirrored ? -mini : mini;
      spr.scaleY = mini;
      spr.setVisible(true);
    }
    tintSwingLayers(player);
    syncSwingCeiling(player);
  }

  function updateSwingAnimation(player, dt) {
    if (!player?.p?.isSwing) return;
    const frame = Math.max(0, Number(dt) || 0);
    player._swingAnimTime = (Number(player._swingAnimTime) || 0) + frame;
    const phase = player._swingAnimTime * SWING_ANIM_SPEED;
    const target = Math.sin(phase) * SWING_ANIM_DISTANCE;
    const current = Number(player._swingAnimOffset) || 0;
    const smoothing = Math.min(1, frame * 10);
    player._swingAnimOffset = current + (target - current) * smoothing;
  }

  function clampSwingToBounds(player) {
    if (!player?.p?.isSwing) return;
    const floor = Number(player._gameLayer?.getFloorY?.());
    const ceiling = Number(player._gameLayer?.getCeilingY?.());
    if (!Number.isFinite(floor) || !Number.isFinite(ceiling)) return;
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
    player._swingAnimTime = 0;
    player._swingAnimOffset = 0;
    player.stopRotation?.();
    player._rotation = 0;
    player.setCubeVisible(false);
    player.setShipVisible(false);
    player.setBallVisible?.(false);
    player.setWaveVisible?.(false);
    player.setSpiderVisible?.(false);
    player.setRobotVisible?.(false);
    setSwingVisible(player, true);
    syncSwingCeiling(player);
    clampSwingToBounds(player);
  }

  function exitSwing(player) {
    if (!player?.p?.isSwing) return;
    player.p.isSwing = false;
    player.p.onGround = false;
    player.p.onCeiling = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.yVelocity = 0;
    player._swingAnimOffset = 0;
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
  }

  if (typeof PlayerObject !== 'undefined' && PlayerObject.prototype) {
    PlayerObject.prototype.enterSwingMode = function() { enterSwing(this); };
    PlayerObject.prototype.exitSwingMode = function() { exitSwing(this); };

    const originalEnterShipMode = PlayerObject.prototype.enterShipMode;
    if (typeof originalEnterShipMode === 'function' && !PlayerObject.prototype.__gd22SwingShipGuardPatched) {
      PlayerObject.prototype.__gd22SwingShipGuardPatched = true;
      PlayerObject.prototype.enterShipMode = function(...args) {
        if (this.p?.isSwing) {
          this.p.isFlying = false;
          this.setShipVisible(false);
          return;
        }
        return originalEnterShipMode.apply(this, args);
      };
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
        if (enteredThisFrame) {
          this._lastCollisionWorldX = Number(args[0]) + (typeof centerX === 'number' ? centerX : 0);
          this._lastCollisionWorldY = this.p.y;
          return;
        }
        if (this.p?.isSwing) {
          const savedFlying = this.p.isFlying;
          const savedGround = this.p.onGround;
          const savedCeiling = this.p.onCeiling;
          this.p.isFlying = true;
          try {
            return originalCheckCollisions.apply(this, args);
          } finally {
            this.p.isFlying = savedFlying;
            this.p.onGround = savedGround;
            this.p.onCeiling = savedCeiling;
            this.p.isSwing = true;
            this.setShipVisible(false);
            setSwingVisible(this, true);
            clampSwingToBounds(this);
            syncSwingCeiling(this);
          }
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

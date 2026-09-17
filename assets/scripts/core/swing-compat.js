/* Geometry Dash 2.2 Swing compatibility layer. */
(() => {
  if (window.__gd22SwingCompatLoaded) return;
  window.__gd22SwingCompatLoaded = true;

  const SWING_PORTAL_ID = 1933;
  const SWING_GRAVITY = 0.36;
  const SWING_MAX_VELOCITY = 13;

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
    tintSwingLayers(player);
  }

  function setSwingVisible(player, visible) {
    makeSwingSprite(player);
    const layers = [player._swingGlow, player._swingBase, player._swingOverlay, player._swingExtra];
    for (const spr of layers) if (spr) spr.setVisible(!!visible);
    if (visible) tintSwingLayers(player);
    if (player._swingSprite) player._swingSprite.setScale(player.p?.isMini ? 0.6 : 1);
  }

  function syncSwingSprite(player, dt = 0) {
    if (!player?.p?.isSwing) return;
    makeSwingSprite(player);
    if (!player._swingBase) return;

    // The Swing stays on the player's horizontal screen anchor. It must not
    // use world X or an animated X offset, which caused the icon to drift away.
    const x = player.p.mirrored
      ? (typeof screenWidth === 'number' ? screenWidth - centerX : centerX)
      : centerX;
    const y = Number.isFinite(player._lastScreenY) ? player._lastScreenY : b(player.p.y);
    const mini = player.p.isMini ? 0.6 : 1;

    // Swing points in the direction of gravity. Do not rotate it 180 degrees:
    // the atlas artwork itself contains the correct orientation.
    const rotation = 0;
    const layers = [player._swingGlow, player._swingBase, player._swingOverlay, player._swingExtra];
    for (const spr of layers) {
      if (!spr) continue;
      spr.x = x;
      spr.y = y;
      spr.rotation = rotation;
      spr.scaleX = player.p.mirrored ? -mini : mini;
      spr.scaleY = mini;
      spr.setVisible(true);
    }
    tintSwingLayers(player);
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

    // Exit the old mode first, then restore the exact gravity from the portal.
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
    player.stopRotation?.();
    player._rotation = 0;

    player.setCubeVisible(false);
    player.setShipVisible(false);
    player.setBallVisible?.(false);
    player.setWaveVisible?.(false);
    player.setSpiderVisible?.(false);
    player.setRobotVisible?.(false);
    setSwingVisible(player, true);
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
    setSwingVisible(player, false);
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

        // Do not let the same collision pass continue through the old portal
        // chain after entering Swing. That was immediately re-processing the
        // portal and could flip gravity or put the player into Ship.
        if (enteredThisFrame) {
          this._lastCollisionWorldX = Number(args[0]) + (typeof centerX === 'number' ? centerX : 0);
          this._lastCollisionWorldY = this.p.y;
          return;
        }

        if (this.p?.isSwing) {
          // Native collision code already has the correct Ship/Fly treatment
          // for floor and ceiling. Temporarily expose Swing as aerial only
          // while collision is calculated; restore Swing immediately after.
          const savedFlying = this.p.isFlying;
          const savedGround = this.p.onGround;
          const savedCeiling = this.p.onCeiling;
          this.p.isFlying = true;
          try {
            const result = originalCheckCollisions.apply(this, args);
            return result;
          } finally {
            this.p.isFlying = savedFlying;
            this.p.onGround = savedGround;
            this.p.onCeiling = savedCeiling;
            this.p.isSwing = true;
            this.setShipVisible(false);
            setSwingVisible(this, true);
            clampSwingToBounds(this);
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
          syncSwingSprite(this, Number(args[2]) || 0);
          this.setCubeVisible(false);
          this.setShipVisible(false);
          this.setBallVisible?.(false);
          this.setWaveVisible?.(false);
          this.setSpiderVisible?.(false);
          this.setRobotVisible?.(false);
        } else if (this._swingSprite) {
          setSwingVisible(this, false);
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
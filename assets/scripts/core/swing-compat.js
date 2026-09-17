/* Geometry Dash 2.2 Swing compatibility layer.
 * Platformer and Spider Orb remain untouched.
 */
(() => {
  if (window.__gd22SwingCompatLoaded) return;
  window.__gd22SwingCompatLoaded = true;

  const SWING_PORTAL_ID = 1933;
  const SWING_GRAVITY = 1.13;
  const SWING_CLICK_VELOCITY = 10.5;
  const SWING_MAX_VELOCITY = 18;

  function getSourceLevelObject(player, collider) {
    const linkedId = collider?._eeObjectId;
    if (linkedId === undefined || linkedId === null) return null;
    const layer = player?._gameLayer;
    return layer?._resetobject?.[linkedId] || layer?._resetObject?.[linkedId] || null;
  }

  function isSwingCollider(player, collider) {
    if (!collider) return false;
    if (String(collider.type || "").toLowerCase() === "portal_swing") return true;
    const source = getSourceLevelObject(player, collider);
    return Number(source?.id) === SWING_PORTAL_ID || String(source?.sub || "").toLowerCase() === "swing";
  }

  function isActuallyTouchingSwingPortal(player, collider, worldX) {
    if (!player || !collider) return false;
    const size = player.p?.isMini ? 18 : 30;
    const x = Number(worldX);
    const y = Number(player.p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (typeof player._isPlayerTouchingPortalHitbox === "function") {
      return player._isPlayerTouchingPortalHitbox(collider, x, y, size);
    }
    const w = Number(collider.w) || 0;
    const h = Number(collider.h) || 0;
    const rot = (Number(collider.rotationDegrees) || 0) * Math.PI / 180;
    const halfW = w / 2, halfH = h / 2;
    const rw = Math.abs(halfW * Math.cos(rot)) + Math.abs(halfH * Math.sin(rot));
    const rh = Math.abs(halfW * Math.sin(rot)) + Math.abs(halfH * Math.cos(rot));
    return !(x + size <= collider.x - rw) && !(x - size >= collider.x + rw) &&
      !(y + size <= collider.y - rh) && !(y - size >= collider.y + rh);
  }

  function setSwingVisibility(player, visible) {
    if (!player) return;
    if (!player._swingSprite) {
      const scene = player._scene;
      const candidates = ["swing_01_001.png", "swing_01_2_001.png", "swing_01_extra_001.png"];
      for (const frame of candidates) {
        try {
          if (typeof addImageToScene === "function") {
            const sprite = addImageToScene(scene, 0, 0, frame);
            if (sprite) {
              player._swingSprite = sprite;
              sprite.setOrigin(0.5, 0.5);
              sprite.setDepth(12);
              break;
            }
          }
          const info = typeof getAtlasFrame === "function" ? getAtlasFrame(scene, frame) : null;
          if (info && scene?.add?.image) {
            player._swingSprite = scene.add.image(0, 0, info.atlas, info.frame);
            player._swingSprite.setOrigin(0.5, 0.5);
            player._swingSprite.setDepth(12);
            break;
          }
        } catch (_) {}
      }
    }
    if (player._swingSprite) {
      player._swingSprite.setVisible(!!visible);
      player._swingSprite.setScale(player.p?.isMini ? 0.6 : 1);
    }
  }

  function syncSwingSprite(player) {
    if (!player?._swingSprite || !player.p?.isSwing) return;
    const scene = player._scene;
    const x = Number.isFinite(scene?._playerWorldX)
      ? scene._playerWorldX
      : (typeof centerX === "number" ? centerX + Number(player.p.x || 0) : Number(player.p.x || 0));
    const y = typeof b === "function" ? b(player.p.y) : player.p.y;
    player._swingSprite.setPosition(x, y);
    player._swingSprite.setRotation(player.p.gravityFlipped ? Math.PI : 0);
    player._swingSprite.setVisible(true);
    player.setShipVisible(false);
    player.setCubeVisible(false);
    player.setBallVisible?.(false);
    player.setWaveVisible?.(false);
    player.setSpiderVisible?.(false);
    player.setRobotVisible?.(false);
  }

  function clampSwingToLevelBounds(player) {
    if (!player?.p?.isSwing) return;
    const layer = player._gameLayer;
    const floorY = Number(layer?.getFloorY?.());
    const ceilingY = Number(layer?.getCeilingY?.());
    if (!Number.isFinite(floorY) || !Number.isFinite(ceilingY)) return;

    const size = player.p.isMini ? 18 : 30;
    const minY = floorY + size;
    const maxY = ceilingY - size;
    if (minY > maxY) return;

    if (player.p.y < minY) {
      player.p.y = minY;
      if (player.p.yVelocity < 0) player.p.yVelocity = 0;
    } else if (player.p.y > maxY) {
      player.p.y = maxY;
      if (player.p.yVelocity > 0) player.p.yVelocity = 0;
    }
  }

  function enterSwing(player, portal = null) {
    if (!player?.p || player.p.isSwing) return;

    // Keep the gravity the player already has when entering the portal.
    // Normal gravity stays normal; inverted gravity stays inverted.
    const entryGravityFlipped = !!player.p.gravityFlipped;

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
    player.p.onGround = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.yVelocity = 0;
    player.p.upKeyPressed = false;
    player.p.queuedHold = false;

    // Some exit-mode methods can normalize their own state. Restore the
    // gravity that was active immediately before entering Swing.
    player.p.gravityFlipped = entryGravityFlipped;

    // Do NOT move the player to the portal center. Swing starts exactly at
    // the player's current position, like the other gravity-based modes.
    player.stopRotation?.();
    player._rotation = player.p.gravityFlipped ? Math.PI : 0;
    player.setCubeVisible(false);
    player.setShipVisible(false);
    player.setBallVisible?.(false);
    player.setWaveVisible?.(false);
    player.setSpiderVisible?.(false);
    player.setRobotVisible?.(false);
    setSwingVisibility(player, true);
    clampSwingToLevelBounds(player);
  }

  function exitSwing(player) {
    if (!player?.p?.isSwing) return;
    player.p.isSwing = false;
    player.p.onGround = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.yVelocity = 0;
    setSwingVisibility(player, false);
    player.setCubeVisible(!player.p.isBall && !player.p.isFlying && !player.p.isWave && !player.p.isUfo && !player.p.isSpider && !player.p.isRobot);
  }

  function swingClick(player) {
    if (!player?.p?.isSwing || player.p.isDead) return;
    player.p.gravityFlipped = !player.p.gravityFlipped;
    player.p.yVelocity = player.p.gravityFlipped ? -SWING_CLICK_VELOCITY : SWING_CLICK_VELOCITY;
    player.p.onGround = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player.p.upKeyPressed = false;
    player.p.queuedHold = false;
    player.p._orbActivationConsumedForPress = true;
    player.stopRotation?.();
    player._rotation = player.p.gravityFlipped ? Math.PI : 0;
  }

  if (typeof PlayerObject !== "undefined" && PlayerObject.prototype) {
    PlayerObject.prototype.enterSwingMode = function(portal = null) { enterSwing(this, portal); };
    PlayerObject.prototype.exitSwingMode = function() { exitSwing(this); };

    const originalEnterShipMode = PlayerObject.prototype.enterShipMode;
    if (typeof originalEnterShipMode === "function" && !PlayerObject.prototype.__gd22SwingShipGuardPatched) {
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
    if (typeof originalUpdateJump === "function" && !PlayerObject.prototype.__gd22SwingPhysicsPatched) {
      PlayerObject.prototype.__gd22SwingPhysicsPatched = true;
      PlayerObject.prototype.updateJump = function(dt) {
        if (!this.p?.isSwing) return originalUpdateJump.call(this, dt);
        const frame = Math.max(0, Number(dt) || 0);
        const gravitySign = this.p.gravityFlipped ? -1 : 1;
        this.p.yVelocity += SWING_GRAVITY * frame * gravitySign;
        this.p.yVelocity = Math.max(-SWING_MAX_VELOCITY, Math.min(SWING_MAX_VELOCITY, this.p.yVelocity));
        this.p.onGround = false;
        this.p.canJump = false;
        this.p.isJumping = false;
        clampSwingToLevelBounds(this);
        const target = this.p.gravityFlipped ? Math.PI : 0;
        if (!this.rotateActionActive) this._rotation += (target - this._rotation) * Math.min(1, frame * 0.35);
      };
    }

    const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
    if (typeof originalCheckCollisions === "function" && !PlayerObject.prototype.__gd22SwingCollisionPatched) {
      PlayerObject.prototype.__gd22SwingCollisionPatched = true;
      PlayerObject.prototype.checkCollisions = function(...args) {
        if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
          const pieceWidth = Number(args[0]) + (typeof centerX === "number" ? centerX : 0);
          const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];
          for (const obj of nearby) {
            if (!isSwingCollider(this, obj)) continue;
            if (!isActuallyTouchingSwingPortal(this, obj, pieceWidth)) continue;
            obj.type = "portal_swing";
            obj.swingPortal = true;
            obj.swingPortalId = SWING_PORTAL_ID;
            if (!this._isObjectActivated?.(obj)) {
              this._setObjectActivated?.(obj, true);
              this._playPortalShine?.(obj);
              enterSwing(this, obj);
            }
            break;
          }
        }
        return originalCheckCollisions.apply(this, args);
      };
    }

    const originalSyncSprites = PlayerObject.prototype.syncSprites;
    if (typeof originalSyncSprites === "function" && !PlayerObject.prototype.__gd22SwingSyncPatched) {
      PlayerObject.prototype.__gd22SwingSyncPatched = true;
      PlayerObject.prototype.syncSprites = function(...args) {
        const result = originalSyncSprites.apply(this, args);
        if (this.p?.isSwing) {
          setSwingVisibility(this, true);
          syncSwingSprite(this);
        } else if (this._swingSprite) this._swingSprite.setVisible(false);
        return result;
      };
    }
  }

  if (typeof GameScene !== "undefined" && GameScene.prototype && !GameScene.prototype.__gd22SwingPatched) {
    GameScene.prototype.__gd22SwingPatched = true;
    const originalCreate = GameScene.prototype.create;
    if (typeof originalCreate === "function") {
      GameScene.prototype.create = function(...args) {
        const result = originalCreate.apply(this, args);
        const scene = this;
        const handlePress = () => {
          if (scene._player?.p?.isSwing) swingClick(scene._player);
          if (scene._player2?.p?.isSwing) swingClick(scene._player2);
        };
        scene.input?.on("pointerdown", handlePress);
        scene.input?.keyboard?.on("keydown-SPACE", handlePress);
        scene.input?.keyboard?.on("keydown-UP", handlePress);
        scene._gd22SwingPressHandler = handlePress;
        return result;
      };
    }
  }

  window.gd22Swing = {
    enter: player => enterSwing(player),
    exit: player => exitSwing(player),
    click: player => swingClick(player)
  };
})();
/* Geometry Dash 2.2 Swing compatibility layer.
 * Maps the real level-object definition to portal_swing before PlayerObject
 * processes collisions, so the normal portal_fly -> Ship path is never used.
 * Platformer and Spider Orb remain untouched.
 */
(() => {
  if (window.__gd22SwingCompatLoaded) return;
  window.__gd22SwingCompatLoaded = true;

  // 1933 is kept as a fallback for object tables that do not expose `sub`.
  // If allObjects provides sub:"swing", that definition is preferred.
  const SWING_PORTAL_ID = 1933;
  const SWING_GRAVITY = 1.13;
  const SWING_CLICK_VELOCITY = 10.5;
  const SWING_MAX_VELOCITY = 18;

  function isSwingDefinition(levelObj, objectDef) {
    if (!levelObj) return false;
    if (String(objectDef?.sub || "").toLowerCase() === "swing") return true;
    return Number(levelObj.id) === SWING_PORTAL_ID;
  }

  function setSwingVisibility(player, visible) {
    if (!player) return;
    if (!player._swingSprite) {
      const scene = player._scene;
      const candidates = [
        String(window.currentSwing || "swing_01") + "_001.png",
        "swing_01_001.png",
        "swing_01_2_001.png",
        "swing_01_extra_001.png"
      ];
      for (const frame of [...new Set(candidates)]) {
        try {
          if (typeof addImageToScene === "function") {
            const sprite = addImageToScene(scene, 0, 0, frame);
            if (sprite) {
              player._swingSprite = sprite;
              player._swingSprite.setOrigin(0.5, 0.5);
              player._swingSprite.setDepth(12);
              break;
            }
          }
          const info = typeof getAtlasFrame === "function" ? getAtlasFrame(scene, frame) : null;
          if (info) {
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
    const x = Number.isFinite(scene?._playerWorldX) ? scene._playerWorldX : 0;
    const y = typeof b === "function" ? b(player.p.y) : player.p.y;
    player._swingSprite.setPosition(x, y);
    player._swingSprite.setRotation(player.p.gravityFlipped ? Math.PI : 0);
    player._swingSprite.setVisible(true);
    player.setShipVisible(false);
    player.setCubeVisible(false);
    player.setBallVisible(false);
    player.setWaveVisible(false);
    player.setSpiderVisible(false);
    player.setRobotVisible(false);
  }

  function enterSwing(player, portal = null) {
    if (!player || !player.p || player.p.isSwing) return;
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
    if (portal) {
      const portalY = Number(portal.portalY ?? portal.y);
      if (Number.isFinite(portalY)) player.p.y = portalY;
    }
    player.stopRotation?.();
    player._rotation = player.p.gravityFlipped ? Math.PI : 0;
    player.setCubeVisible(false);
    player.setShipVisible(false);
    player.setBallVisible(false);
    player.setWaveVisible(false);
    player.setSpiderVisible(false);
    player.setRobotVisible(false);
    setSwingVisibility(player, true);
    player._setGamemodeFlyBounds?.(true, player.p.y, 30, false);
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
    player._setGamemodeFlyBounds?.(false, 0);
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

  if (typeof LevelObject !== "undefined" && LevelObject.prototype && !LevelObject.prototype.__gd22SwingObjectMappingPatched) {
    LevelObject.prototype.__gd22SwingObjectMappingPatched = true;
    const originalSpawnObject = LevelObject.prototype._spawnObject;
    if (typeof originalSpawnObject === "function") {
      LevelObject.prototype._spawnObject = function(levelObj, ...args) {
        const objectDef = typeof getObjectFromId === "function" ? getObjectFromId(levelObj?.id) : null;
        const result = originalSpawnObject.call(this, levelObj, ...args);
        if (!isSwingDefinition(levelObj, objectDef)) return result;

        // _spawnObject creates the collider with objectDef.sub -> portal type.
        // Convert only this object's collider to the dedicated Swing type.
        const linkedId = levelObj?._eeObjectId;
        for (const collider of this.objects || []) {
          if (!collider || collider._eeObjectId !== linkedId) continue;
          if (String(collider.type || "").startsWith("portal_") || collider.type === "portal") {
            collider.type = "portal_swing";
            collider.swingPortal = true;
            collider.swingPortalId = Number(levelObj.id) || SWING_PORTAL_ID;
            collider.portalX = collider.portalX ?? collider.x;
            collider.portalY = collider.portalY ?? collider.y;
          }
        }
        return result;
      };
    }
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

        // Swing uses its own gravity + click impulse; it never enters _updateFlyJump().
        this.p.yVelocity -= SWING_GRAVITY * frame * this.flipMod();
        if (this.p.gravityFlipped) {
          this.p.yVelocity = Math.min(this.p.yVelocity, SWING_MAX_VELOCITY);
        } else {
          this.p.yVelocity = Math.max(this.p.yVelocity, -SWING_MAX_VELOCITY);
        }
        this.p.onGround = false;
        this.p.canJump = false;
        this.p.isJumping = false;

        if (!this.rotateActionActive) {
          const target = this.p.gravityFlipped ? Math.PI : 0;
          this._rotation += (target - this._rotation) * Math.min(1, frame * 0.35);
        }
      };
    }

    const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
    if (typeof originalCheckCollisions === "function" && !PlayerObject.prototype.__gd22SwingCollisionPatched) {
      PlayerObject.prototype.__gd22SwingCollisionPatched = true;
      PlayerObject.prototype.checkCollisions = function(...args) {
        if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
          const pieceWidth = (Number(args[0]) || 0) + (typeof centerX === "number" ? centerX : 0);
          const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];
          for (const obj of nearby) {
            if (String(obj?.type || "").toLowerCase() !== "portal_swing") continue;
            const half = this.p.isMini ? 18 : 30;
            const portalW = Number(obj.w) || 30;
            const portalH = Number(obj.h) || 60;
            const dx = pieceWidth - Number(obj.x || 0);
            const dy = this.p.y - Number(obj.y || 0);
            const hw = portalW * 0.5 + half;
            const hh = portalH * 0.5 + half;
            if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;

            if (typeof this._isObjectActivated !== "function" || !this._isObjectActivated(obj)) {
              this._setObjectActivated?.(obj, true);
              this._playPortalShine?.(obj);
              enterSwing(this, obj);
            }
            // Let the original collision pass continue. It now sees portal_swing,
            // not portal_fly, so it cannot send the player into Ship mode.
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
        } else if (this._swingSprite) {
          this._swingSprite.setVisible(false);
        }
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
          if (scene._state?.isSwing) swingClick(scene._player);
          if (scene._isDual && scene._state2?.isSwing) swingClick(scene._player2);
        };
        scene.input?.on("pointerdown", handlePress);
        scene.input?.keyboard?.on("keydown-SPACE", handlePress);
        scene.input?.keyboard?.on("keydown-UP", handlePress);
        scene._gd22SwingPressHandler = handlePress;
        return result;
      };
    }

    const originalGetDualModeId = GameScene.prototype._getDualModeId;
    if (typeof originalGetDualModeId === "function") {
      GameScene.prototype._getDualModeId = function(state) {
        if (state?.isSwing) return "swing";
        return originalGetDualModeId.call(this, state);
      };
    }

    const originalSetPlayerGamemode = GameScene.prototype._setPlayerGamemode;
    if (typeof originalSetPlayerGamemode === "function") {
      GameScene.prototype._setPlayerGamemode = function(player, state, mode, keepVelocity = true) {
        if (mode === "swing") {
          enterSwing(player);
          if (!keepVelocity) state.yVelocity = 0;
          return;
        }
        if (state?.isSwing && mode !== "swing") exitSwing(player);
        return originalSetPlayerGamemode.call(this, player, state, mode, keepVelocity);
      };
    }
  }

  window.gd22Swing = {
    enter: (player) => enterSwing(player),
    exit: (player) => exitSwing(player),
    click: (player) => swingClick(player)
  };
})();
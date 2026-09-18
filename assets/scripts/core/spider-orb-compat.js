/* Geometry Dash 2.2 Spider Pad compatibility.
 * Spider Pad (3005) is automatic: touching it teleports the Spider
 * to the nearest valid surface in the current travel direction.
 *
 * This file deliberately patches only Spider Pad collision handling.
 * The normal collision system remains untouched for every other object.
 */
(() => {
  if (window.__gd22SpiderPadCompatLoaded) return;
  window.__gd22SpiderPadCompatLoaded = true;

  const SPIDER_PAD_ID = 3005;

  function isSpiderPadObject(obj) {
    return !!obj &&
      String(obj.type || "") === "jumpPad" &&
      Number(obj.padId) === SPIDER_PAD_ID;
  }

  function touchesPad(player, pad, worldX) {
    if (!pad || !Number.isFinite(worldX)) return false;

    // Reuse the engine's rotated-rectangle collision helper when available.
    if (typeof player._isPlayerTouchingPortalHitbox === "function") {
      return player._isPlayerTouchingPortalHitbox(
        pad,
        worldX,
        player.p.y,
        player.p.isMini ? 18 : 30,
        player._lastCollisionWorldX,
        player._lastCollisionWorldY
      );
    }

    const half = player.p.isMini ? 18 : 30;
    const hw = Math.max(0, Number(pad.w) || 0) / 2;
    const hh = Math.max(0, Number(pad.h) || 0) / 2;
    if (hw <= 0 || hh <= 0) return false;

    return Math.abs(worldX - Number(pad.x)) < hw + half &&
           Math.abs(player.p.y - Number(pad.y)) < hh + half;
  }

  function activateSpiderPad(player, pad, worldX) {
    if (!player || !pad || !player.p || !player.p.isSpider || player.p.isDead) return false;
    if (player._isObjectActivated(pad)) return false;
    if (!touchesPad(player, pad, worldX)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const goingUp = !player.p.gravityFlipped;
    const surfaceY = player._findSpiderTeleportSurface?.(goingUp, worldX, playerSize);

    if (surfaceY === null || !Number.isFinite(surfaceY)) {
      return false;
    }

    const targetY = goingUp ? surfaceY - playerSize : surfaceY + playerSize;

    // Keep Spider Pad consistent with Spider's normal teleport safety.
    const blockingHazard = player._findSpiderTeleportHazard?.(
      goingUp,
      worldX,
      playerSize,
      targetY
    );

    player._setObjectActivated(pad, true);
    player._orbpadHitEffect(pad);

    const oldY = player.p.y;

    if (blockingHazard && !window.noClip) {
      const bounds = blockingHazard.bounds;
      const hazardCenterY = (Number(bounds?.lower) + Number(bounds?.upper)) / 2;
      player.p.y = Number.isFinite(hazardCenterY) ? hazardCenterY : targetY;
      player._spawnSpiderTeleportEffects?.(oldY, player.p.y);
      player.p.yVelocity = 0;
      player.p.onGround = false;
      player.p.canJump = false;
      player.p.isJumping = false;
      player.killPlayer();
      return true;
    }

    player.p.y = targetY;
    player.flipGravity(goingUp, 1.0);
    player.p.onCeiling = goingUp;
    player.p.yVelocity = 0;
    player.p.onGround = true;
    player.p.canJump = true;
    player.p.isJumping = false;
    player.p._spiderTeleportNoclipDeathPending = false;

    if (blockingHazard && window.noClip) {
      player.p._spiderTeleportNoclipDeathPending = true;
      player.p.diedThisFrame = true;
    }

    player._syncOtherDualGravityForBlueBoost();
    player.playGravityEffect(player.p.gravityFlipped);
    player._spawnSpiderTeleportEffects?.(oldY, player.p.y);

    return true;
  }

  if (typeof PlayerObject === "undefined" || !PlayerObject.prototype) return;

  const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
  if (typeof originalCheckCollisions !== "function" ||
      PlayerObject.prototype.__gd22SpiderPadCompatPatched) return;

  PlayerObject.prototype.__gd22SpiderPadCompatPatched = true;

  PlayerObject.prototype.checkCollisions = function(...args) {
    if (this.p?.isSpider &&
        !this.p?.isDead &&
        !this.p?.ignorePortals &&
        this._gameLayer?.getNearbySectionObjects) {

      const worldX = Number(this._scene?._playerWorldX);
      const playerWorldX = Number.isFinite(worldX)
        ? worldX
        : Number(args[0]) + (typeof centerX === "number" ? centerX : 0);

      const nearby = this._gameLayer.getNearbySectionObjects(playerWorldX) || [];

      for (const pad of nearby) {
        if (activateSpiderPad(this, pad, playerWorldX)) {
          // Do not run the ordinary pad physics for Spider Pad.
          return;
        }
      }
    }

    return originalCheckCollisions.apply(this, args);
  };
})();
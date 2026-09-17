/* Geometry Dash 2.2 Spider Orb compatibility.
 * Object 3004 / spiderRing_001.png is the Spider Orb.
 * Its ARROW determines the destination and final gravity:
 *   - arrow UP   -> teleport to the nearest surface above + gravity UP
 *   - arrow DOWN -> teleport to the nearest surface below + gravity DOWN
 * This makes it behave like the Spider/"black" teleport plus the
 * corresponding blue-gravity result, instead of a yellow orb.
 */
(() => {
  if (window.__gd22SpiderOrbCompatLoaded) return;
  window.__gd22SpiderOrbCompatLoaded = true;

  const SPIDER_ORB_OBJECT_ID = 3004;
  const SPIDER_ORB_ID = 444;

  function isSpiderOrbObject(obj) {
    if (!obj) return false;
    if (Number(obj.id) === SPIDER_ORB_OBJECT_ID) return true;
    const frame = String(obj.frame || obj.objectFrame || obj.spriteFrame || '').toLowerCase();
    return frame.includes('spiderring');
  }

  function spiderArrowPointsUp(gameObj) {
    // The Spider Orb's default arrow points upward at 0 degrees.
    // Rotation is read from the actual level object/collider.
    const rotation = Number(gameObj?.orbRotation ?? gameObj?.rotationDegrees ?? 0) || 0;
    const rad = rotation * Math.PI / 180;
    const directionY = -Math.cos(rad);
    return directionY < 0;
  }

  function activateSpiderOrb(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return false;
    if (player._isObjectActivated(gameObj)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const playerWorldX = player._scene?._playerWorldX ?? centerX;
    const pointsUp = spiderArrowPointsUp(gameObj);

    // Arrow direction chooses the surface, independently of the gravity
    // the player currently has. This is the important 2.2 behavior.
    const targetGravityFlipped = pointsUp;
    const oldY = player.p.y;
    const targetSurfaceY = player._findSpiderTeleportSurface(pointsUp, playerWorldX, playerSize);

    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);
    player._consumeOrbActivationInput();

    if (targetSurfaceY !== null && Number.isFinite(targetSurfaceY)) {
      const targetY = pointsUp
        ? targetSurfaceY - playerSize
        : targetSurfaceY + playerSize;

      const blockingHazard = player._findSpiderTeleportHazard(
        pointsUp,
        playerWorldX,
        playerSize,
        targetY
      );

      if (blockingHazard && !window.noClip) {
        const bounds = blockingHazard.bounds;
        const hazardCenterY = (bounds.lower + bounds.upper) / 2;
        player.p.y = Number.isFinite(hazardCenterY) ? hazardCenterY : targetY;
        player._spawnSpiderTeleportEffects(oldY, player.p.y);
        player.p.yVelocity = 0;
        player.p.onGround = false;
        player.p.canJump = false;
        player.p.isJumping = false;
        player.killPlayer();
        return true;
      }

      player.p.y = targetY;
      player.p.lastY = targetY;
      player.flipGravity(targetGravityFlipped, 1.0);
      player._syncOtherDualGravityForBlueBoost();
      player.playGravityEffect(targetGravityFlipped);

      if (blockingHazard && window.noClip) {
        player.p._spiderTeleportNoclipDeathPending = true;
        player.p.diedThisFrame = true;
      }

      player._spawnSpiderTeleportEffects(oldY, player.p.y);
    } else {
      // If there is no valid platform, still apply the arrow's gravity.
      player.flipGravity(targetGravityFlipped, 1.0);
      player._syncOtherDualGravityForBlueBoost();
      player.playGravityEffect(targetGravityFlipped);
    }

    player.p.yVelocity = 0;
    player.p.onGround = true;
    player.p.onCeiling = targetGravityFlipped;
    player.p.canJump = true;
    player.p.isJumping = false;
    player.p._spiderTeleportAnimTimer = 0;
    player.runRotateAction();
    player._markActivatedOrbSprites(gameObj);
    return true;
  }

  if (typeof PlayerObject === 'undefined' || !PlayerObject.prototype) return;
  const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
  if (typeof originalCheckCollisions !== 'function' || PlayerObject.prototype.__gd22SpiderOrbCompatPatched) return;

  PlayerObject.prototype.__gd22SpiderOrbCompatPatched = true;
  PlayerObject.prototype.checkCollisions = function(...args) {
    if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
      const pieceWidth = (Number(args[0]) || 0) + (typeof centerX === 'number' ? centerX : 0);
      const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];

      for (const gameObj of nearby) {
        if (!isSpiderOrbObject(gameObj)) continue;

        // Normalize the object for any native code that inspects orbId.
        gameObj.orbId = SPIDER_ORB_ID;

        const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
        const needsClick = justPressed || (this.p.queuedHold && this.p.upKeyDown);
        if (!needsClick || this._isObjectActivated(gameObj)) continue;

        // Handle Spider Orb completely here so the normal yellow/pink/blue
        // orb branch in player.js never gets a chance to treat it as yellow.
        activateSpiderOrb(this, gameObj);
      }
    }

    return originalCheckCollisions.apply(this, args);
  };
})();

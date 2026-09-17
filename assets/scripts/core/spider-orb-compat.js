/* Geometry Dash 2.2 Spider Orb compatibility.
 * Object 3004 is the local Spider Orb.
 * The orb collider stores the original level object ID in orbId.
 * Its arrow direction chooses the destination surface and final gravity.
 *
 * Arrow UP   -> teleport to ceiling + gravity inverted.
 * Arrow DOWN -> teleport to floor   + gravity normal.
 */
(() => {
  if (window.__gd22SpiderOrbCompatLoaded) return;
  window.__gd22SpiderOrbCompatLoaded = true;

  const SPIDER_ORB_OBJECT_ID = 3004;
  const SPIDER_ORB_ID = 444;

  function isSpiderOrbObject(obj) {
    if (!obj) return false;

    // level.js creates orb colliders with: orbObj.orbId = levelObj.id
    if (Number(obj.orbId) === SPIDER_ORB_OBJECT_ID) return true;
    if (Number(obj.id) === SPIDER_ORB_OBJECT_ID) return true;

    const frame = String(obj.frame || obj.objectFrame || obj.spriteFrame || '').toLowerCase();
    return frame.includes('spiderring');
  }

  function arrowPointsUp(gameObj) {
    // The local Spider Orb points upward at 0 degrees.
    // 180 degrees therefore points downward.
    const rotation = Number(gameObj?.orbRotation ?? gameObj?.rotation ?? 0) || 0;
    const rad = rotation * Math.PI / 180;
    return (-Math.cos(rad)) < 0;
  }

  function activateSpiderOrb(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return;
    if (player._isObjectActivated(gameObj)) return;

    const playerSize = player.p.isMini ? 18 : 30;
    const pointsUp = arrowPointsUp(gameObj);
    const floorY = Number(player._gameLayer?.getFloorY?.());
    const ceilingY = Number(player._gameLayer?.getCeilingY?.());

    // Normalize it to the native Spider Orb ID so the rest of the game
    // recognizes it as the Spider Orb instead of a normal yellow orb.
    gameObj.orbId = SPIDER_ORB_ID;

    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);
    player._consumeOrbActivationInput();

    if (pointsUp && Number.isFinite(ceilingY)) {
      player.p.y = ceilingY - playerSize;
    } else if (!pointsUp && Number.isFinite(floorY)) {
      player.p.y = floorY + playerSize;
    }

    // The arrow decides the resulting gravity, regardless of the gravity
    // the player had before touching the orb.
    player.flipGravity(pointsUp, 1.0);
    player._syncOtherDualGravityForBlueBoost();
    player.playGravityEffect(pointsUp);

    player.p.yVelocity = 0;
    player.p.onGround = false;
    player.p.canJump = false;
    player.p.isJumping = false;

    // Spider Orb gravity should feel like a sharp vertical flip, not a
    // long diagonal/smooth rotation. Snap the player to the new orientation.
    player.stopRotation();
    player._rotation = 0;
    player.p.onCeiling = pointsUp;
    player.p.onGround = !pointsUp;
    player._markActivatedOrbSprites(gameObj);
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

        const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
        const needsClick = justPressed || (this.p.queuedHold && this.p.upKeyDown);
        if (!needsClick || this._isObjectActivated(gameObj)) continue;

        // Handle it before native orb processing. Once activated, the native
        // collision code will skip it, so it cannot fall through to yellow.
        activateSpiderOrb(this, gameObj);
      }
    }

    return originalCheckCollisions.apply(this, args);
  };
})();

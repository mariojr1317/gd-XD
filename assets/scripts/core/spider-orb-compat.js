/* Geometry Dash 2.2 Spider Orb compatibility.
 * Object 3004 is the local Spider Orb.
 * Each Spider Orb keeps its own collider/activation state and its own
 * rotation, so multiple Spider Orbs can coexist without interfering.
 *
 * Arrow UP   -> teleport to ceiling + gravity inverted.
 * Arrow DOWN -> teleport to floor   + gravity normal.
 */
(() => {
  if (window.__gd22SpiderOrbCompatLoaded) return;
  window.__gd22SpiderOrbCompatLoaded = true;

  const SPIDER_ORB_OBJECT_ID = 3004;

  function isSpiderOrbObject(obj) {
    if (!obj) return false;
    if (Number(obj.orbId) === SPIDER_ORB_OBJECT_ID) return true;
    if (Number(obj.id) === SPIDER_ORB_OBJECT_ID) return true;
    const frame = String(obj.frame || obj.objectFrame || obj.spriteFrame || '').toLowerCase();
    return frame.includes('spiderring');
  }

  function arrowPointsUp(gameObj) {
    const rotation = Number(gameObj?.orbRotation ?? gameObj?.rotation ?? 0) || 0;
    const rad = rotation * Math.PI / 180;
    return (-Math.cos(rad)) < 0;
  }

  function activateSpiderOrb(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return false;
    if (player._isObjectActivated(gameObj)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const pointsUp = arrowPointsUp(gameObj);
    const floorY = Number(player._gameLayer?.getFloorY?.());
    const ceilingY = Number(player._gameLayer?.getCeilingY?.());

    // IMPORTANT: do not replace orbId with 444 here. Every collider must keep
    // its original object ID (3004), otherwise multiple Spider Orbs can become
    // indistinguishable to later collision processing.
    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);
    player._consumeOrbActivationInput();

    if (pointsUp && Number.isFinite(ceilingY)) {
      player.p.y = ceilingY - playerSize;
    } else if (!pointsUp && Number.isFinite(floorY)) {
      player.p.y = floorY + playerSize;
    }

    // This particular orb decides the destination and resulting gravity.
    player.flipGravity(pointsUp, 1.0);
    player._syncOtherDualGravityForBlueBoost();
    player.playGravityEffect(pointsUp);

    player.p.yVelocity = 0;
    player.p.onGround = !pointsUp;
    player.p.onCeiling = pointsUp;
    player.p.canJump = true;
    player.p.isJumping = false;
    player.stopRotation();
    player._rotation = 0;
    player._markActivatedOrbSprites(gameObj);
    return true;
  }

  if (typeof PlayerObject === 'undefined' || !PlayerObject.prototype) return;

  const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
  if (typeof originalCheckCollisions !== 'function' || PlayerObject.prototype.__gd22SpiderOrbCompatPatched) return;

  PlayerObject.prototype.__gd22SpiderOrbCompatPatched = true;
  PlayerObject.prototype.checkCollisions = function(...args) {
    let activatedSpiderOrb = false;

    if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
      const pieceWidth = (Number(args[0]) || 0) + (typeof centerX === 'number' ? centerX : 0);
      const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];

      // Only one orb can consume a single press. Pick the first Spider Orb
      // that is actually in range; the next orb remains independent and can
      // be activated on a later press.
      const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
      const needsClick = justPressed || (this.p.queuedHold && this.p.upKeyDown);

      if (needsClick) {
        for (const gameObj of nearby) {
          if (!isSpiderOrbObject(gameObj)) continue;
          if (typeof this._isPlayerTouchingPortalHitbox === 'function') {
            // Orb colliders are still regular jump-ring colliders. Use their
            // own bounds instead of treating every nearby Spider Orb as hit.
            const size = this.p.isMini ? 18 : 30;
            const left = gameObj.x - gameObj.w / 2;
            const right = gameObj.x + gameObj.w / 2;
            const top = gameObj.y - gameObj.h / 2;
            const bottom = gameObj.y + gameObj.h / 2;
            const touching = !(pieceWidth + size <= left || pieceWidth - size >= right || this.p.y + size <= top || this.p.y - size >= bottom);
            if (!touching) continue;
          }

          if (activateSpiderOrb(this, gameObj)) {
            activatedSpiderOrb = true;
            break;
          }
        }
      }
    }

    // The native orb handler does not know object 3004, so it is safe to run
    // for other objects. If this frame activated a Spider Orb, skip the native
    // collision pass so that the same press cannot trigger another orb.
    if (activatedSpiderOrb) return;
    return originalCheckCollisions.apply(this, args);
  };
})();

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

  function getSourceLevelObject(player, collider) {
    const linkedId = collider?._eeObjectId;
    if (linkedId === undefined || linkedId === null) return null;
    const layer = player?._gameLayer;
    return layer?._resetobject?.[linkedId] || layer?._resetObject?.[linkedId] || null;
  }

  function isSpiderOrbObject(obj) {
    if (!obj) return false;
    if (Number(obj.orbId) === SPIDER_ORB_OBJECT_ID) return true;
    if (Number(obj.id) === SPIDER_ORB_OBJECT_ID) return true;
    const frame = String(obj.frame || obj.objectFrame || obj.spriteFrame || '').toLowerCase();
    return frame.includes('spiderring');
  }

  function arrowPointsUp(player, gameObj) {
    // The important value is the level object's rotation. Prefer the original
    // level object when available, then fall back to the collider rotation.
    // 0 degrees is the normal UP-facing Spider Orb; 180 degrees is DOWN.
    const source = getSourceLevelObject(player, gameObj);
    let rotation = Number(source?.rot);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.orbRotation);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.rotationDegrees);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.rotation);
    if (!Number.isFinite(rotation)) rotation = 0;

    rotation = ((rotation % 360) + 360) % 360;
    let pointsUp = rotation < 90 || rotation >= 270;

    // Vertical flip reverses the arrow direction. Horizontal flip does not.
    if (source?.flipY) pointsUp = !pointsUp;
    return pointsUp;
  }

  function activateSpiderOrb(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return false;
    if (player._isObjectActivated(gameObj)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const pointsUp = arrowPointsUp(player, gameObj);
    const floorY = Number(player._gameLayer?.getFloorY?.());
    const ceilingY = Number(player._gameLayer?.getCeilingY?.());

    // Keep the original object ID on every collider so separate Spider Orbs
    // never become the same object internally.
    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);
    player._consumeOrbActivationInput();

    if (pointsUp && Number.isFinite(ceilingY)) {
      player.p.y = ceilingY - playerSize;
    } else if (!pointsUp && Number.isFinite(floorY)) {
      player.p.y = floorY + playerSize;
    }

    // The arrow decides the resulting gravity.
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
      const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
      const needsClick = justPressed || (this.p.queuedHold && this.p.upKeyDown);

      if (needsClick) {
        for (const gameObj of nearby) {
          if (!isSpiderOrbObject(gameObj)) continue;

          const size = this.p.isMini ? 18 : 30;
          const left = gameObj.x - gameObj.w / 2;
          const right = gameObj.x + gameObj.w / 2;
          const top = gameObj.y - gameObj.h / 2;
          const bottom = gameObj.y + gameObj.h / 2;
          const touching = !(pieceWidth + size <= left || pieceWidth - size >= right || this.p.y + size <= top || this.p.y - size >= bottom);
          if (!touching) continue;

          if (activateSpiderOrb(this, gameObj)) {
            activatedSpiderOrb = true;
            break;
          }
        }
      }
    }

    // A Spider Orb consumes this press before native orb handling can run.
    if (activatedSpiderOrb) return;
    return originalCheckCollisions.apply(this, args);
  };
})();
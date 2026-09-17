/* Geometry Dash 2.2 Spider Orb / Spider Pad compatibility.
 * Object 3004 is the local Spider Orb.
 * Pad ID 3005 is the local Spider Pad.
 * Each object keeps its own activation state and direction.
 *
 * Spider Orb: tap/click required.
 * Spider Pad: activates automatically on contact.
 *
 * UP   -> teleport to ceiling + gravity inverted.
 * DOWN -> teleport to floor   + gravity normal.
 */
(() => {
  if (window.__gd22SpiderOrbCompatLoaded) return;
  window.__gd22SpiderOrbCompatLoaded = true;

  const SPIDER_ORB_OBJECT_ID = 3004;
  const SPIDER_PAD_ID = 3005;

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

  function isSpiderPadObject(obj) {
    if (!obj) return false;
    if (Number(obj.padId) === SPIDER_PAD_ID) return true;
    return String(obj.type || '').toLowerCase() === 'jump_pad' && Number(obj.id) === SPIDER_PAD_ID;
  }

  function arrowPointsUp(player, gameObj) {
    // Spider objects use their original level rotation. 0 degrees is UP and
    // 180 degrees is DOWN. Vertical flip reverses the direction.
    const source = getSourceLevelObject(player, gameObj);
    let rotation = Number(source?.rot);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.orbRotation);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.rotationDegrees);
    if (!Number.isFinite(rotation)) rotation = Number(gameObj?.rotation);
    if (!Number.isFinite(rotation)) rotation = 0;

    rotation = ((rotation % 360) + 360) % 360;
    let pointsUp = rotation < 90 || rotation >= 270;
    if (source?.flipY) pointsUp = !pointsUp;
    return pointsUp;
  }

  function isTouchingSpiderObject(player, gameObj, pieceWidth) {
    const size = player.p.isMini ? 18 : 30;
    const left = gameObj.x - gameObj.w / 2;
    const right = gameObj.x + gameObj.w / 2;
    const top = gameObj.y - gameObj.h / 2;
    const bottom = gameObj.y + gameObj.h / 2;
    return !(pieceWidth + size <= left || pieceWidth - size >= right || player.p.y + size <= top || player.p.y - size >= bottom);
  }

  function activateSpiderObject(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return false;
    if (player._isObjectActivated(gameObj)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const pointsUp = arrowPointsUp(player, gameObj);
    const floorY = Number(player._gameLayer?.getFloorY?.());
    const ceilingY = Number(player._gameLayer?.getCeilingY?.());

    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);

    if (pointsUp && Number.isFinite(ceilingY)) {
      player.p.y = ceilingY - playerSize;
    } else if (!pointsUp && Number.isFinite(floorY)) {
      player.p.y = floorY + playerSize;
    }

    // The object's direction decides the resulting gravity, independent of
    // the gravity the player had before touching it.
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
    player._markActivatedOrbSprites?.(gameObj);
    return true;
  }

  function consumeSpiderInput(player) {
    if (typeof player._consumeOrbActivationInput === 'function') {
      player._consumeOrbActivationInput();
    }
  }

  if (typeof PlayerObject === 'undefined' || !PlayerObject.prototype) return;

  const originalCheckCollisions = PlayerObject.prototype.checkCollisions;
  if (typeof originalCheckCollisions !== 'function' || PlayerObject.prototype.__gd22SpiderOrbCompatPatched) return;

  PlayerObject.prototype.__gd22SpiderOrbCompatPatched = true;
  PlayerObject.prototype.checkCollisions = function(...args) {
    let activatedSpiderObject = false;

    if (!this.p?.isDead && !this.p?.ignorePortals && this._gameLayer?.getNearbySectionObjects) {
      const pieceWidth = (Number(args[0]) || 0) + (typeof centerX === 'number' ? centerX : 0);
      const nearby = this._gameLayer.getNearbySectionObjects(pieceWidth) || [];

      // Spider Pad is automatic: contact alone is enough.
      for (const gameObj of nearby) {
        if (!isSpiderPadObject(gameObj)) continue;
        if (!isTouchingSpiderObject(this, gameObj, pieceWidth)) continue;
        if (activateSpiderObject(this, gameObj)) {
          activatedSpiderObject = true;
          break;
        }
      }

      // Spider Orb still requires a tap/click.
      if (!activatedSpiderObject) {
        const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
        const needsClick = justPressed || (this.p.queuedHold && this.p.upKeyDown);

        if (needsClick) {
          for (const gameObj of nearby) {
            if (!isSpiderOrbObject(gameObj)) continue;
            if (!isTouchingSpiderObject(this, gameObj, pieceWidth)) continue;

            if (activateSpiderObject(this, gameObj)) {
              consumeSpiderInput(this);
              activatedSpiderObject = true;
              break;
            }
          }
        }
      }
    }

    // Let exactly one Spider Orb/Pad consume the collision frame. This keeps
    // the native jump-pad/orb branch from processing the same object again.
    if (activatedSpiderObject) return;
    return originalCheckCollisions.apply(this, args);
  };
})();
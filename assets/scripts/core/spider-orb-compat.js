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

  function isSpiderPadObject(obj) {
    if (!obj) return false;
    if (Number(obj.padId) === SPIDER_PAD_ID) return true;
    return String(obj.type || '').toLowerCase() === 'jump_pad' && Number(obj.id) === SPIDER_PAD_ID;
  }

  function isTouchingSpiderObject(player, gameObj, pieceWidth) {
    const size = player.p.isMini ? 18 : 30;
    const left = gameObj.x - gameObj.w / 2;
    const right = gameObj.x + gameObj.w / 2;
    const top = gameObj.y - gameObj.h / 2;
    const bottom = gameObj.y + gameObj.h / 2;
    return !(pieceWidth + size <= left || pieceWidth - size >= right ||
      player.p.y + size <= top || player.p.y - size >= bottom);
  }

  function activateSpiderPad(player, gameObj) {
    if (!player || !gameObj || player.p?.isDead) return false;
    if (player._isObjectActivated(gameObj)) return false;

    const playerSize = player.p.isMini ? 18 : 30;
    const floorY = Number(player._gameLayer?.getFloorY?.());
    const ceilingY = Number(player._gameLayer?.getCeilingY?.());

    player._setObjectActivated(gameObj, true);
    player._orbpadHitEffect(gameObj, true);

    // Spider Pad follows the current gravity: normal -> ceiling,
    // inverted -> floor. It does not depend on the arrow/orb direction.
    if (!player.p.gravityFlipped && Number.isFinite(ceilingY)) {
      player.p.y = ceilingY - playerSize;
      player.flipGravity(true, 1.0);
      player.p.onCeiling = true;
    } else if (player.p.gravityFlipped && Number.isFinite(floorY)) {
      player.p.y = floorY + playerSize;
      player.flipGravity(false, 1.0);
      player.p.onCeiling = false;
    }

    player._syncOtherDualGravityForBlueBoost();
    player.playGravityEffect(player.p.gravityFlipped);
    player.p.yVelocity = 0;
    player.p.onGround = false;
    player.p.canJump = false;
    player.p.isJumping = false;
    player._markActivatedOrbSprites?.(gameObj);
    return true;
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
        if (activateSpiderPad(this, gameObj)) {
          activatedSpiderObject = true;
          break;
        }
      }
    }

    if (activatedSpiderObject) return;
    return originalCheckCollisions.apply(this, args);
  };
})();
/* Geometry Dash 2.2 Spider Orb compatibility.
 * The local object table uses object 3004 / spiderRing_001.png for the
 * Spider Orb. Normalize it to orbId 444 so PlayerObject can execute the
 * Spider behavior instead of falling through to the normal yellow-orb code.
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

        // Normalize the object before the native orb code reads gameObj.orbId.
        // This is the important part: without it the object falls through to
        // the normal yellow-orb branch.
        gameObj.orbId = SPIDER_ORB_ID;
      }
    }

    return originalCheckCollisions.apply(this, args);
  };
})();

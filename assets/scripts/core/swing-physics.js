/* Geometry Dash 2.2 Swing physics.
 * This patches PlayerObject.updateJump so Swing does not use cube/ship physics.
 */
(() => {
  if (window.__gd22SwingPhysicsLoaded) return;
  window.__gd22SwingPhysicsLoaded = true;

  const SWING_GRAVITY = 1.13;
  const SWING_CLICK_VELOCITY = 10.5;
  const SWING_MAX_VELOCITY = 18;

  if (typeof PlayerObject === "undefined" || !PlayerObject.prototype) return;
  const originalUpdateJump = PlayerObject.prototype.updateJump;
  if (typeof originalUpdateJump !== "function" || PlayerObject.prototype.__gd22SwingPhysicsPatched) return;

  PlayerObject.prototype.__gd22SwingPhysicsPatched = true;
  PlayerObject.prototype._updateSwingJump = function(dt) {
    const state = this.p;
    const frame = Math.max(0, Number(dt) || 0);

    if (state.upKeyPressed) {
      state.upKeyPressed = false;
      state.queuedHold = false;
      this.flipGravity(!state.gravityFlipped, 1.0);
      state.yVelocity = this.flipMod() * SWING_CLICK_VELOCITY;
      state.onGround = false;
      state.canJump = false;
      state.isJumping = false;
      this.stopRotation();
      this._rotation = state.gravityFlipped ? Math.PI : 0;
      return;
    }

    if (state.gravityFlipped) {
      state.yVelocity -= SWING_GRAVITY * frame * this.flipMod();
      state.yVelocity = Math.min(state.yVelocity, SWING_MAX_VELOCITY);
    } else {
      state.yVelocity -= SWING_GRAVITY * frame * this.flipMod();
      state.yVelocity = Math.max(state.yVelocity, -SWING_MAX_VELOCITY);
    }

    state.onGround = false;
    state.canJump = false;
    state.isJumping = false;

    if (!this.rotateActionActive) {
      const target = state.gravityFlipped ? Math.PI : 0;
      this._rotation += (target - this._rotation) * Math.min(1, frame * 0.35);
    }
  };

  PlayerObject.prototype.updateJump = function(dt) {
    if (this.p?.isSwing) {
      this._updateSwingJump(dt);
      return;
    }
    return originalUpdateJump.call(this, dt);
  };
})();

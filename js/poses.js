/* Snow TT Bros: extra poses on top of Kit.people.pose. ST.pose(p, phase, mode, k, u) eases a person toward a pose;
   u (0..1) is how far through a one-shot move (a throw, a kick) we are. Modes added here:
     stand, throwT (Teddy's basketball jump-shot throw), throwM (Tommy's one-arm ✌️ throw), kick, push, dizzy (sitting
     with stars), tickle (giggling), balloon (hanging from a balloon), hi5, cheer, and still-legged wave / peace / give.
   Everything else goes straight to Kit.people.pose (run, walk, jump, fall, boxing, jumpshot, ...). */
(function () {
  'use strict';
  const ST = (window.ST = window.ST || {});
  const KP = Kit.people;
  const ease = (o, prop, v, k) => { o[prop] += (v - o[prop]) * k; };

  function legsStill(p, k) {
    ease(p.legL.rotation, 'x', 0, k);
    ease(p.legR.rotation, 'x', 0, k);
    p.hips.position.y = p.hipY;
  }

  ST.pose = function (p, ph, mode, k, u = 0) {
    let rigY = 0.55, rigZ = 0;
    switch (mode) {
      case 'stand':
        KP.pose(p, ph, 'idle', k);
        ease(p.armL.rotation, 'z', -0.12 - Math.sin(ph * 0.5) * 0.03, k);
        ease(p.armR.rotation, 'z', 0.12 + Math.sin(ph * 0.5) * 0.03, k);
        p.hips.position.y = p.hipY + Math.sin(ph * 0.5) * 0.012;
        break;
      case 'throwT': {
        // Teddy's jump-shot throw: both hands overhead, then the release forward
        KP.pose(p, ph, 'jumpshot', k);
        const a = 2.9 - 1.3 * Math.min(1, u * 1.6);
        ease(p.armL.rotation, 'x', a, Math.max(k, 0.5));
        ease(p.armR.rotation, 'x', a + 0.1, Math.max(k, 0.5));
        ease(p.legL.rotation, 'x', 0.25, k);
        ease(p.legR.rotation, 'x', 0.25, k);
        rigY += Math.sin(Math.PI * Math.min(1, u)) * 0.14;
        break;
      }
      case 'throwM': {
        // Tommy's throw: right arm winds up overhead and flings forward with peace fingers
        KP.pose(p, ph, 'idle', k);
        const a = 2.9 - 1.6 * Math.min(1, u * 1.5);
        ease(p.armR.rotation, 'x', a, Math.max(k, 0.5));
        ease(p.armR.rotation, 'z', 0.1, k);
        ease(p.armL.rotation, 'x', 0.7, k);
        ease(p.armL.rotation, 'z', -0.3, k);
        ease(p.hips.rotation, 'y', 0.35 - u * 0.6, k);
        ease(p.legL.rotation, 'x', 0.35, k);
        ease(p.legR.rotation, 'x', -0.2, k);
        if (p.fingers && p.fingers.length === 4) { p.fingers[2].visible = true; p.fingers[3].visible = true; }
        break;
      }
      case 'kick':
        KP.pose(p, ph, 'idle', k);
        ease(p.legR.rotation, 'x', 1.45 * Math.sin(Math.PI * Math.min(1, u * 1.3)) + 0.1, 0.6);
        ease(p.legL.rotation, 'x', -0.15, k);
        ease(p.armL.rotation, 'z', -1.0, k);
        ease(p.armR.rotation, 'z', 1.0, k);
        ease(p.hips.rotation, 'x', 0.15, k);
        break;
      case 'push':
        KP.pose(p, ph, 'walk', k);
        ease(p.armL.rotation, 'x', 1.5, k);
        ease(p.armR.rotation, 'x', 1.5, k);
        ease(p.hips.rotation, 'x', -0.3, k);
        break;
      case 'dizzy':
        // flopped down on his bottom, legs out, swaying under circling stars
        KP.pose(p, ph, 'idle', k);
        ease(p.legL.rotation, 'x', 1.45, k);
        ease(p.legR.rotation, 'x', 1.35, k);
        ease(p.armL.rotation, 'z', -0.9, k);
        ease(p.armR.rotation, 'z', 0.9, k);
        ease(p.armL.rotation, 'x', 0.3, k);
        ease(p.armR.rotation, 'x', 0.3, k);
        ease(p.hips.rotation, 'x', 0.15, k);
        ease(p.head.rotation, 'x', Math.sin(ph * 3) * 0.15, k);
        rigY = -0.12;
        rigZ = Math.sin(ph * 3) * 0.12;
        break;
      case 'tickle':
        KP.pose(p, ph, 'idle', k);
        ease(p.armL.rotation, 'x', 0.9, k);
        ease(p.armR.rotation, 'x', 0.9, k);
        ease(p.armL.rotation, 'z', 0.5, k);
        ease(p.armR.rotation, 'z', -0.5, k);
        ease(p.head.rotation, 'x', -0.3, k);
        ease(p.hips.rotation, 'x', 0.1 + Math.sin(ph * 9) * 0.08, 0.6);
        rigZ = Math.sin(ph * 9) * 0.08;
        break;
      case 'balloon':
        KP.pose(p, ph, 'idle', k);
        ease(p.armL.rotation, 'x', 2.95, k);
        ease(p.armR.rotation, 'x', 2.95, k);
        ease(p.armL.rotation, 'z', 0.12, k);
        ease(p.armR.rotation, 'z', -0.12, k);
        ease(p.legL.rotation, 'x', 0.35 + Math.sin(ph * 2) * 0.2, k);
        ease(p.legR.rotation, 'x', 0.1 - Math.sin(ph * 2) * 0.2, k);
        break;
      case 'hi5':
        KP.pose(p, ph, 'idle', k);
        ease(p.armR.rotation, 'x', 3.0, k);
        ease(p.armR.rotation, 'z', 0.25, k);
        ease(p.armL.rotation, 'z', -0.4, k);
        rigY += Math.abs(Math.sin(ph * 2)) * 0.1;
        break;
      case 'cheer':
        KP.pose(p, ph, 'idle', k);
        ease(p.armL.rotation, 'x', 2.9, k);
        ease(p.armR.rotation, 'x', 2.9, k);
        ease(p.armL.rotation, 'z', -0.4, k);
        ease(p.armR.rotation, 'z', 0.4, k);
        rigY += Math.abs(Math.sin(ph * 2)) * 0.18;
        break;
      case 'wave': case 'peace': case 'give':
        KP.pose(p, ph, mode, k);
        legsStill(p, k);
        if (mode === 'peace') rigY += Math.abs(Math.sin(ph)) * 0.1;
        break;
      case 'boxing': case 'guard': case 'jab': case 'straight':
        KP.pose(p, ph, mode, k);
        break;
      default:
        KP.pose(p, ph, mode, k);
    }
    ease(p.rig.position, 'y', rigY, Math.max(k, 0.25));
    ease(p.rig.rotation, 'z', rigZ, k);
  };
})();

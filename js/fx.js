/* HydraPet — effets Lottie (confettis, éclaboussure…) avec repli automatique.
   Les animations viennent de assets/lottie/*.json (voir docs/ANIMATION.md). */
(function (root) {
  const HP = (root.HP = root.HP || {});

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function available(name) {
    return !!(root.lottie && HP.lottieData && HP.lottieData[name]);
  }

  /** Joue une animation une fois dans `container`. Renvoie true si elle est lancée, false sinon
   *  (l'appelant peut alors utiliser son effet de secours). */
  function play(name, container, opts) {
    opts = opts || {};
    if (!container || !available(name) || reducedMotion()) return false;
    const layer = document.createElement('div');
    layer.className = 'fx-lottie ' + (opts.className || '');
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
    let anim;
    try {
      anim = root.lottie.loadAnimation({
        container: layer,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: HP.lottieData[name],
        rendererSettings: { preserveAspectRatio: opts.fit || 'xMidYMid meet' },
      });
    } catch (e) {
      layer.remove();
      return false;
    }
    const cleanup = () => { try { anim.destroy(); } catch (e) { /* déjà détruite */ } layer.remove(); };
    anim.addEventListener('complete', cleanup);
    anim.addEventListener('data_failed', cleanup);
    setTimeout(cleanup, (opts.maxMs || 6000));
    return true;
  }

  HP.fx = { play, available, reducedMotion };
})(typeof window !== 'undefined' ? window : globalThis);

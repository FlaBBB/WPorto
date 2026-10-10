import {
  TIMELINE,
  measureLayout,
  presentationOffset,
  progressForRead,
  gatherAt,
  activeSceneIndex,
  sceneScrollPosition,
  skyState,
  publishRate,
  clamp01,
  type Layout,
} from "./timeline";

/**
 * Global timeline controller.
 *
 * One progress drives everything: progress = scrollY / (scrollHeight - innerHeight),
 * 0 at the Opening and 1 at the Contact bottom. The journey supplies a native
 * scroll budget; the sticky stage is pinned and this controller scrubs the scene
 * stack from that single progress. It never snaps, completes a gesture or traps
 * wheel/touch/keyboard input: stopping leaves the exact partial position.
 *
 * Pinning is opt-in: the layout is activated only after setup succeeds and only
 * without a reduced-motion preference, so no-JS, an aborted module or reduced
 * motion always expose the whole ordinary document.
 */
export function setupSectionScroll(onAfterRender?: (activeIndex: number) => void) {
  const journey = document.querySelector<HTMLElement>("[data-journey]");
  const stage = document.querySelector<HTMLElement>("[data-stage]");
  const contactSurface = document.querySelector<HTMLElement>(".contact-surface");
  const header = document.querySelector<HTMLElement>(".site-header");
  const scenes = TIMELINE.map((scene) =>
    document.querySelector<HTMLElement>(`[data-scene="${scene.id}"]`),
  );
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lastScene = TIMELINE.length - 1;
  // Idle drift magnitude and how strongly scroll speed adds to it.
  const IDLE_RATE = 1;
  const VELOCITY_SCALE = 0.0003;
  const MAX_RATE = 8;

  let layout: Layout | undefined;
  let active = false;
  let velocity = 0;
  let velocityTimer = 0;
  let previousY = window.scrollY;
  let previousT = performance.now();
  let frame = 0;
  let layoutDirty = false;
  // One shared motion-time source. The signed scroll speed sets the rate; the
  // clock integrates the elapsed OLD rate at every rate change and at every
  // paint, so a scroll pulse that starts and ends between slow frames is never
  // lost, and reverse runs the phase backward.
  let motionClock = 0;
  let rate = IDLE_RATE;
  let lastLoopAt = 0;
  let loopFrame = 0;
  let lastOffset = NaN;
  let lastProgress = 0;
  // The exact native scroll position the last paint was computed from. The
  // shared loop compares against the real position, so a scroll that commits
  // without a timely event (a programmatic jump, or a coalesced native scroll)
  // still repaints instead of leaving the presentation stale.
  let lastRenderedY = NaN;
  // Pending one-shot corrections (focus placement, initial deep-link re-assert).
  // Deliberate input cancels them so they never fight the reader's own scroll.
  let pendingFocus = 0;
  let pendingHash = 0;

  function measure() {
    if (!journey) return;
    // A layout change is a correction, not idle motion. Capture the current
    // scene, its content read offset and its hold/transition fraction from the
    // OLD layout, then map that exact pose into the new one, so a resize or a
    // disclosure expansion keeps the same chapter and read position instead of
    // jumping (or moving a focused summary).
    let pose:
      | { index: number; readOffset: number; holdFraction: number; transition: number }
      | undefined;
    if (layout && layout.scroll > 0) {
      const p = clamp01(window.scrollY / layout.scroll);
      const index = activeSceneIndex(p);
      const scene = TIMELINE[index];
      const offset = presentationOffset(p, layout);
      const top = layout.tops[index] ?? 0;
      const overflow = Math.max(0, (layout.heights[index] ?? 0) - layout.viewport);
      const stableScroll = (scene.outStart - scene.start) * layout.scroll;
      const holdScroll = Math.max(0, stableScroll - overflow);
      const inTransition =
        scene.outEnd > scene.outStart && p >= scene.outStart && p < scene.outEnd;
      pose = {
        index,
        readOffset: Math.max(0, offset - top),
        holdFraction:
          holdScroll > 0
            ? clamp01(((p - scene.start) * layout.scroll) / holdScroll)
            : 0,
        transition: inTransition
          ? (p - scene.outStart) / (scene.outEnd - scene.outStart)
          : -1,
      };
    }
    const viewport = window.innerHeight;
    const heights = scenes.map((scene) =>
      scene ? scene.getBoundingClientRect().height : viewport,
    );
    layout = measureLayout(heights, viewport);
    journey.style.height = `${layout.scroll + viewport}px`;
    // A relayout, disclosure expansion or resize invalidates cached text bounds.
    skyState.layoutVersion += 1;
    // It also invalidates the render memo: the scene tops have been replaced, so
    // every transform must be reapplied even when the presentation offset is
    // unchanged (e.g. a taller Opening at progress 0, where the offset stays 0
    // but every later scene's top moved).
    lastOffset = NaN;
    if (pose) {
      const scene = TIMELINE[pose.index];
      const next =
        pose.transition >= 0
          ? scene.outStart + pose.transition * (scene.outEnd - scene.outStart)
          : progressForRead(
              pose.index,
              pose.readOffset,
              layout,
              pose.holdFraction,
            );
      window.scrollTo({ top: next * layout.scroll, behavior: "instant" });
    }
  }

  function syncOrdinaryHeader() {
    if (!header) return;
    const contact = document.querySelector<HTMLElement>("#contact-path");
    if (!contact) return;
    const box = header.getBoundingClientRect();
    const centre = box.top + box.height / 2;
    const band = contact.getBoundingClientRect();
    header.dataset.contact = String(band.top <= centre && band.bottom > centre);
  }

  function contactOpacity(p: number) {
    // The violet Contact surface scrubs in with the entering screen, driven by
    // the same global progress as the scene transforms, so it never appears on
    // an independent timer after native input stops.
    const entering = TIMELINE[lastScene - 1];
    if (p <= entering.outStart) return 0;
    if (p >= entering.outEnd) return 1;
    const local = (p - entering.outStart) / (entering.outEnd - entering.outStart);
    return local * local * (3 - 2 * local);
  }

  /**
   * The Contact surface fades in over the dark stage, so mid-blend the
   * composited backdrop passes through a mid luminance where neither the
   * dark-scene ink nor the plum Contact ink clears the contrast floor. The
   * foreground therefore switches to whichever of white/black keeps the greater
   * contrast against the actual composited colour, and the normal palette is
   * restored at the stable endpoints.
   */
  const parseRgb = (color: string) => {
    const values = color.match(/[\d.]+/g);
    if (!values || values.length < 3) return undefined;
    return values.slice(0, 3).map(Number);
  };
  const relativeLuminance = (rgb: number[]) => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  };
  const contrastRatio = (a: number[], b: number[]) => {
    const one = relativeLuminance(a);
    const two = relativeLuminance(b);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  };
  // The band and the page background behind it are palette constants; read them
  // once so the polarity follows the real colours rather than hardcoded values.
  const band = contactSurface
    ? parseRgb(getComputedStyle(contactSurface).backgroundColor)
    : undefined;
  const base = parseRgb(getComputedStyle(document.documentElement).backgroundColor) ??
    parseRgb(getComputedStyle(document.body).backgroundColor);
  const compositeAt = (opacity: number) => {
    if (!band || !base) return undefined;
    return band.map((value, index) => value * opacity + base[index] * (1 - opacity));
  };

  let contactPhase = "";
  let contactInk = "";
  function publishContactPhase(contact: number) {
    // The published opacity is the rounded value actually written to the
    // surface, so a scene-start scroll that lands a hair below the endpoint
    // still reports the 1.000 that is rendered and restores the plum palette.
    const rounded = Number(contact.toFixed(3));
    const phase = rounded <= 0 ? "off" : rounded >= 1 ? "contact" : "blend";
    const composite = phase === "blend" ? compositeAt(rounded) : undefined;
    const ink = composite
      ? contrastRatio([255, 255, 255], composite) >=
        contrastRatio([0, 0, 0], composite)
        ? "light"
        : "dark"
      : "";
    if (phase === contactPhase && ink === contactInk) return;
    contactPhase = phase;
    contactInk = ink;
    for (const element of [stage, header]) {
      if (!element) continue;
      element.dataset.contactPhase = phase;
      if (ink) element.dataset.contactInk = ink;
      else delete element.dataset.contactInk;
    }
  }
  function clearContactPhase() {
    for (const element of [stage, header]) {
      if (!element) continue;
      delete element.dataset.contactPhase;
      delete element.dataset.contactInk;
    }
    contactPhase = "";
    contactInk = "";
  }

  function publish() {
    skyState.motionClock = motionClock;
    skyState.rate = rate;
  }

  function integrateTo(now: number) {
    // Never integrate while hidden: a throttled timer or a resume would
    // otherwise fold the hidden interval into the phase.
    if (document.hidden || lastLoopAt === 0) {
      lastLoopAt = now;
      return;
    }
    motionClock += ((now - lastLoopAt) / 1000) * rate;
    lastLoopAt = now;
  }

  function setRate(next: number) {
    if (document.hidden) {
      rate = next;
      publishRate(rate);
      return;
    }
    integrateTo(performance.now());
    rate = next;
    publishRate(rate);
  }

  function rateForVelocity(v: number) {
    // Preserve the signed direction even at slow speeds, and keep an explicit
    // positive idle magnitude so the cloud always drifts gently at rest.
    const magnitude = Math.min(MAX_RATE, IDLE_RATE + Math.abs(v) * VELOCITY_SCALE);
    return (v < 0 ? -1 : 1) * magnitude;
  }

  function render() {
    frame = 0;
    if (!layout || !active) return;
    if (layoutDirty) {
      layoutDirty = false;
      measure();
    }
    // The native position is the single source of truth. Recording it even when
    // the presentation offset does not change keeps the loop from re-requesting
    // a paint for a position already consumed.
    const y = window.scrollY;
    lastRenderedY = y;
    const p = layout.scroll > 0 ? clamp01(y / layout.scroll) : 0;
    lastProgress = p;
    const offset = presentationOffset(p, layout);
    if (offset !== lastOffset) {
      lastOffset = offset;
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index];
        if (!scene) continue;
        const top = layout.tops[index] ?? 0;
        scene.style.transform = `translate3d(0, ${(top - offset).toFixed(2)}px, 0)`;
      }
      const contact = contactOpacity(p);
      if (contactSurface) {
        contactSurface.style.opacity = contact.toFixed(3);
        contactSurface.dataset.visible = String(contact > 0);
      }
      if (header) header.dataset.contact = String(contact > 0.5);
      publishContactPhase(contact);
      skyState.gather = preference.matches ? 1 : gatherAt(p);
      skyState.contact = contact;
      skyState.active = activeSceneIndex(p);
      skyState.offset = offset;
      // Foreground clipping and focus exposure depend on the transforms just
      // applied, so they run here rather than from a prior native scroll callback.
      onAfterRender?.(skyState.active);
    }
  }

  function requestRender() {
    if (frame) return;
    frame = requestAnimationFrame(render);
  }

  // The cloud animates continuously, so one shared loop integrates the motion
  // clock and keeps the published state fresh, including through idle holds.
  // It also watches the real native position: `render` always writes
  // `skyState.offset` and `lastOffset` together, so comparing those can never
  // detect a scroll. Comparing the actual `scrollY` is what keeps a position
  // that committed without a timely event from staying unpainted.
  //
  // The loop is already inside a frame callback, so it renders the changed
  // position here rather than queueing another rAF: nesting a frame would add a
  // full frame of latency (measurably ~420ms on software WebKit) before the
  // transforms, and therefore the reveal observer's delivery, could catch up.
  function loop(now: number) {
    loopFrame = requestAnimationFrame(loop);
    integrateTo(now);
    publish();
    if (active && layout && (layoutDirty || window.scrollY !== lastRenderedY)) {
      // Cancel any duplicate queued render so this frame's paint is the only one.
      if (frame) cancelAnimationFrame(frame);
      render();
    }
  }

  function startLoop() {
    if (loopFrame || document.hidden) return;
    lastLoopAt = 0;
    loopFrame = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (loopFrame) cancelAnimationFrame(loopFrame);
    loopFrame = 0;
  }

  function decayVelocity() {
    velocity = 0;
    skyState.velocity = 0;
    setRate(IDLE_RATE);
  }

  function scroll() {
    if (!active) {
      // The ordinary/reduced document has no pinned transforms and no
      // presentation scroll, but the fixed navbar still themes from the real
      // Contact geometry as the page scrolls. Rebase the gesture clock so
      // reactivating the pinned presentation never sees a stale interval.
      previousY = window.scrollY;
      previousT = performance.now();
      syncOrdinaryHeader();
      return;
    }
    const y = window.scrollY;
    const now = performance.now();
    // Clamp the interval: the first scroll after an idle gap would otherwise
    // divide a real gesture by a multi-second dt and underestimate its speed.
    const dt = Math.min(100, Math.max(1, now - previousT));
    velocity = ((y - previousY) / dt) * 1000;
    previousY = y;
    previousT = now;
    // Signed scroll speed: the sky follows every scroll, including holds and
    // reading, and accelerates with faster scrolling. Idle drift resumes after.
    skyState.velocity = preference.matches ? 0 : velocity;
    setRate(preference.matches ? 0 : rateForVelocity(velocity));
    window.clearTimeout(velocityTimer);
    velocityTimer = window.setTimeout(decayVelocity, 140);
    requestRender();
  }

  function scrollToScene(id: string) {
    // Only the pinned presentation maps a scene to a global progress; the
    // ordinary document uses native fragment scrolling.
    if (!active || !layout) return;
    const index = TIMELINE.findIndex((scene) => scene.id === id);
    if (index < 0) return;
    window.scrollTo({
      top: sceneScrollPosition(index, layout),
      behavior: "instant",
    });
    // Settle the presentation at this same placement boundary. An explicit
    // navigation moves the native position; if the transforms were left from
    // the previous position, the browser's own fragment pass reads that stale
    // layout and scrolls by the difference (measured: a 167px Work offset
    // turned a 3266px landing into 3099px). Painting here makes the native
    // position and every scene's pinned top agree before that pass runs.
    render();
  }

  function hash() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) scrollToScene(id);
  }

  // In-page anchors navigate explicitly to their scene's settled position, so a
  // repeated same-hash click still lands correctly instead of relying on native
  // fragment scrolling inside the clipped stage.
  function anchorClick(event: MouseEvent) {
    if (!active) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.hash.slice(1));
    if (!id || !TIMELINE.some((scene) => scene.id === id)) return;
    event.preventDefault();
    scrollToScene(id);
    // Reflect the destination in the URL without a second native jump.
    history.replaceState(null, "", `#${id}`);
  }

  // Map a focus target to its scene's read position and place it there. Shared
  // by the deferred correction so the geometry stays in one place.
  function placeFocus(node: Element) {
    if (!active || !layout) return;
    const scene = node.closest<HTMLElement>("[data-scene]");
    if (!scene) return;
    const index = TIMELINE.findIndex((s) => s.id === scene.dataset.scene);
    if (index < 0) return;
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const box = node.getBoundingClientRect();
    // Use the control's real ring so a control whose outline would sit under the
    // header is still revealed, and an already-visible one stays stationary.
    const style = getComputedStyle(node);
    const ring = Math.max(
      0,
      (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0),
    );
    if (
      box.top - ring >= headerBottom &&
      box.bottom + ring <= window.innerHeight &&
      box.bottom > 0
    )
      return;
    // Map the target to its read offset WITHIN its scene, then to the timeline's
    // own progress, so offscreen focus lands in the right stable/read interval.
    // The scene-local offset is transform-invariant, so it is correct whether or
    // not the browser has already scrolled the element into view.
    const sceneTop = scene.getBoundingClientRect().top;
    const localTop = box.top - sceneTop;
    const sceneHeight = layout.heights[index] ?? 0;
    const desiredRead = Math.min(
      Math.max(0, localTop - headerBottom - ring - 1),
      Math.max(0, sceneHeight - window.innerHeight),
    );
    const next = progressForRead(index, desiredRead, layout);
    window.scrollTo({ top: next * layout.scroll, behavior: "instant" });
  }

  /**
   * Keep a node at a given viewport top after a disclosure relayout, without
   * leaving its scene. In the pinned presentation the scene's read offset is
   * derived from the same hold/read mapping the timeline uses, so a collapse
   * that happens while the scene is held cannot drag native progress into the
   * previous scene: a negative target read offset is clamped into the current
   * hold position instead of jumping backward. The ordinary/reduced document
   * has no pinned mapping, so it compensates with physical pixels.
   */
  function preserveRead(node: Element, viewportTop: number) {
    // A disclosure handoff can move prose inside a held scene without changing
    // the scene's total height or the presentation offset (a collapse and an
    // expand of equal height), so neither the ResizeObserver nor the offset key
    // would change. Bump the layout version so the quiet-box cache recomputes
    // from the real line boxes; the canvas still repaints on its existing budget.
    skyState.layoutVersion += 1;
    if (!active || !layout) {
      const delta = node.getBoundingClientRect().top - viewportTop;
      if (Math.abs(delta) > 0.5)
        window.scrollBy({ top: delta, behavior: "instant" });
      return;
    }
    const scene = node.closest<HTMLElement>("[data-scene]");
    if (!scene) return;
    const index = TIMELINE.findIndex((s) => s.id === scene.dataset.scene);
    if (index < 0) return;
    const entry = TIMELINE[index];
    const scroll = layout.scroll;
    if (scroll <= 0) return;
    const p = clamp01(window.scrollY / scroll);
    const stableScroll = (entry.outStart - entry.start) * scroll;
    const overflow = Math.max(
      0,
      (layout.heights[index] ?? 0) - layout.viewport,
    );
    const holdScroll = Math.max(0, stableScroll - overflow);
    // The current hold fraction, so a target that stays inside the hold resolves
    // to the reader's present position rather than the hold's start.
    const holdFraction =
      holdScroll > 0
        ? clamp01(((p - entry.start) * scroll) / holdScroll)
        : 0;
    const localTop =
      node.getBoundingClientRect().top - scene.getBoundingClientRect().top;
    const readOffset = localTop - viewportTop;
    const next = progressForRead(index, readOffset, layout, holdFraction);
    window.scrollTo({ top: next * scroll, behavior: "instant" });
  }

  // A queued correction is only valid until the user takes over. Any deliberate
  // wheel, touch, pointer (scrollbar drag) or page-key action cancels it, so the
  // controller never reasserts a position against the reader's own scrolling.
  const NAV_KEYS = new Set([
    "PageUp",
    "PageDown",
    "Home",
    "End",
    "ArrowUp",
    "ArrowDown",
    " ",
    "Spacebar",
  ]);
  function cancelCorrections() {
    if (pendingFocus) cancelAnimationFrame(pendingFocus);
    if (pendingHash) cancelAnimationFrame(pendingHash);
    pendingFocus = 0;
    pendingHash = 0;
  }
  function onDeliberateInput(event: Event) {
    if (event.type === "keydown") {
      // Any key returns to keyboard modality, so a pointerdown on a
      // non-focusable background (which sets the pointer flag but never focuses
      // a control) cannot suppress a later keyboard placement.
      pointerFocus = false;
      if (!NAV_KEYS.has((event as KeyboardEvent).key)) return;
    }
    cancelCorrections();
  }

  // Focus placement exists for keyboard navigation (Tab to an offscreen
  // control). A pointer or touch that focuses a control must not scroll: the
  // reader already chose that position, and a disclosure interaction keeps it
  // via its own anchor, so a second correction here would fight it.
  let pointerFocus = false;
  function markPointerFocus() {
    pointerFocus = true;
  }

  function focusIn(event: FocusEvent) {
    const node = event.target;
    if (!(node instanceof Element)) return;
    if (!layout || !active) return;
    if (pointerFocus) {
      pointerFocus = false;
      return;
    }
    // Focusing makes the browser scroll the target into view, and that native
    // scroll can land after this handler and overwrite a synchronous placement
    // (especially while `scroll-behavior: smooth` animates it). Correct once on
    // the next frame, after the native action. It is a one-shot correction that
    // deliberate input cancels, never a persistent pin.
    if (pendingFocus) cancelAnimationFrame(pendingFocus);
    pendingFocus = requestAnimationFrame(() => {
      pendingFocus = 0;
      if (node === document.activeElement && node.isConnected) placeFocus(node);
    });
  }

  function setActive(next: boolean) {
    if (next === active) return;
    // Preserve the reader's logical position across a layout swap (pinned <->
    // ordinary), so toggling reduced motion never jumps to another chapter.
    const preserved = lastProgress;
    active = next;
    document.documentElement.dataset.pinned = String(active);
    if (journey) journey.dataset.active = String(active);
    // While pinned, the controller owns placement. The stylesheet requests
    // `scroll-behavior: smooth`, which would make the browser's own fragment and
    // focus scrolls animate and land after our instant placement, so they are
    // disabled here and restored to the stylesheet's value when unpinned.
    document.documentElement.style.scrollBehavior = active ? "auto" : "";
    if (!active) {
      stopLoop();
      for (const scene of scenes) if (scene) scene.style.transform = "";
      // Clearing the presentation styles invalidates the render memo, so the
      // next activation reapplies transforms instead of skipping them.
      lastOffset = NaN;
      if (journey) journey.style.height = "";
      if (contactSurface) contactSurface.style.opacity = "0";
      // Clear the pinned-mode foreground clip so the ordinary document shows
      // its full content.
      document
        .querySelectorAll<HTMLElement>("[data-scene] .section-content, [data-scene] .site-footer")
        .forEach((element) => (element.style.clipPath = ""));
      // The ordinary/reduced document uses the plain palette, so the transient
      // blend tokens must not survive the switch.
      clearContactPhase();
      const ordinary =
        document.documentElement.scrollHeight - window.innerHeight;
      if (ordinary > 0) {
        window.scrollTo({ top: preserved * ordinary, behavior: "instant" });
      }
      // In the ordinary document the navbar still themes over the violet band
      // from its real viewport geometry.
      syncOrdinaryHeader();
      return;
    }
    measure();
    if (layout && layout.scroll > 0) {
      window.scrollTo({
        top: preserved * layout.scroll,
        behavior: "instant",
      });
    }
    startLoop();
    requestRender();
  }

  function preferenceChange() {
    setActive(!preference.matches);
  }

  // A hidden document must truly pause the motion clock; otherwise the hidden
  // interval is integrated on return. Rebase the loop clock when it resumes.
  function visibility() {
    if (document.hidden) {
      stopLoop();
      return;
    }
    if (active) startLoop();
  }

  // A viewport resize changes the Contact band's position under the fixed
  // navbar. The pinned presentation re-renders its transforms; the ordinary
  // document only needs the header theme refreshed.
  function handleResize() {
    if (!active) {
      syncOrdinaryHeader();
      return;
    }
    requestRender();
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!active) {
      // Ordinary/reduced layout: re-theme from real geometry only.
      syncOrdinaryHeader();
      return;
    }
    // measure() writes the ancestor journey's height. Doing that during scene
    // resize delivery invalidates shallower observations in the same batch;
    // apply it in the existing render frame instead, then paint that layout.
    layoutDirty = true;
    requestRender();
  });
  if (journey) resizeObserver.observe(journey);
  for (const scene of scenes) if (scene) resizeObserver.observe(scene);

  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", handleResize);
  window.addEventListener("hashchange", hash);
  document.addEventListener("click", anchorClick);
  document.addEventListener("focusin", focusIn);
  document.addEventListener("visibilitychange", visibility);
  preference.addEventListener("change", preferenceChange);

  // Activate only without a reduced-motion preference; reduced motion keeps the
  // ordinary, fully readable document. The ordinary document still themes the
  // fixed navbar from real Contact geometry, including at initial load and for
  // a deep link that already scrolled before this module ran.
  setActive(!preference.matches);
  if (active) render();
  else syncOrdinaryHeader();
  const initialHash = window.location.hash;
  if (initialHash) hash();
  if (initialHash && active) {
    // The pinned layout is applied after the browser's own fragment scroll, and
    // that layout change can re-anchor the document position. Re-assert the
    // scene start once on the next frame, so a direct link lands exactly. It is
    // bounded to the initial load, cancelled by deliberate input, and skips if
    // the hash has since changed.
    pendingHash = requestAnimationFrame(() => {
      pendingHash = 0;
      if (active && window.location.hash === initialHash) hash();
    });
  }

  window.addEventListener("wheel", onDeliberateInput, { passive: true });
  window.addEventListener("touchstart", onDeliberateInput, { passive: true });
  window.addEventListener("touchmove", onDeliberateInput, { passive: true });
  window.addEventListener("pointerdown", onDeliberateInput, { passive: true });
  window.addEventListener("keydown", onDeliberateInput, { passive: true });
  // Mark pointer/touch-initiated focus so focusIn does not scroll for it. These
  // fire before the focus event, and a keyboard focus leaves the flag clear.
  window.addEventListener("pointerdown", markPointerFocus, { passive: true });
  window.addEventListener("touchstart", markPointerFocus, { passive: true });

  return {
    destroy() {
      window.clearTimeout(velocityTimer);
      if (frame) cancelAnimationFrame(frame);
      cancelCorrections();
      stopLoop();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("hashchange", hash);
      document.removeEventListener("click", anchorClick);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", preferenceChange);
      window.removeEventListener("wheel", onDeliberateInput);
      window.removeEventListener("touchstart", onDeliberateInput);
      window.removeEventListener("touchmove", onDeliberateInput);
      window.removeEventListener("pointerdown", onDeliberateInput);
      window.removeEventListener("keydown", onDeliberateInput);
      window.removeEventListener("pointerdown", markPointerFocus);
      window.removeEventListener("touchstart", markPointerFocus);
      // Teardown leaves no transient blend tokens behind.
      clearContactPhase();
    },
    preserveRead,
  };
}

<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { Project } from "../lib/portfolio";
  import ProjectPreview from "./ProjectPreview.svelte";
  import SectionHeading from "./SectionHeading.svelte";

  let { projects }: { projects: Project[] } = $props();
  let host: HTMLDivElement;

  /**
   * The path's length in the space its dashes are measured in.
   *
   * `getTotalLength()` reports user-space units, but a stroke drawn with
   * `vector-effect: non-scaling-stroke` has its dash pattern measured in screen
   * units instead. On a non-uniformly fitted drawing — this tree is stretched
   * horizontally and squashed vertically so its branches reach their columns — the
   * two lengths differ, and a user-space dash is consumed before the path ends,
   * leaving the stroke visibly short of its dot. Sampling the path through its own
   * screen matrix gives the length the dash actually has to cover.
   */
  function paintedLength(path: SVGPathElement) {
    const total = path.getTotalLength();
    const matrix = path.getScreenCTM();
    if (!total || !matrix) return total;
    const steps = 32;
    const toScreen = (point: DOMPoint) => ({
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    });
    let length = 0;
    let previous = toScreen(path.getPointAtLength(0));
    for (let step = 1; step <= steps; step += 1) {
      const point = toScreen(path.getPointAtLength((total * step) / steps));
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    return length;
  }

  onMount(() => {
    /*
      The reservation decides which layout this visit gets, and it is claimed only
      while it is still held. If the pre-paint hold has already released it, the
      section is the readable in-flow layout for this visit: taking the pinned
      layout then would reformat the page under a visitor who may already be
      reading it, and would move everything below them. Their studies stay as they
      are — visible, and complete — so nothing is left mid-draw either.
    */
    if (!document.documentElement.classList.contains("work-preview")) {
      window.__workPreviewReady = true;
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stage = host.querySelector<HTMLElement>(".work-preview-stage")!;
    const panels = [...stage.querySelectorAll<HTMLElement>(".work-preview-panel")];
    const rows = [...host.querySelectorAll<HTMLElement>(".work-index > li")];
    let active = 0;
    let frame = 0;
    let lastScroll = window.scrollY;
    let wipe: gsap.core.Tween | undefined;

    // One paused timeline per source study. The studies are small DOM/SVG
    // objects, not another canvas or a video-rendering runtime.
    const artworks = [...host.querySelectorAll<HTMLElement>(".project-preview")].map((figure) => {
      const nodes = [...figure.querySelectorAll<HTMLElement>("[data-art-node]")];
      const paths = [...figure.querySelectorAll<SVGPathElement>("[data-art-path]")];
      const timeline = gsap.timeline({ paused: true });
      const kind = figure.dataset.kind;
      if (paths.length) {
        for (const path of paths) {
          /*
            The dash is measured in screen units, not user units, because these
            strokes are drawn with `vector-effect: non-scaling-stroke`. The
            drawing's fitting is deliberately non-uniform — the tree is stretched
            horizontally and squashed vertically to reach its columns — so a dash
            taken from `getTotalLength()` is consumed before the path ends and the
            stroke stops visibly short of its dot. The length is read at draw time
            from the path's own screen geometry, so a resize is measured rather
            than assumed.
          */
          timeline.set(
            path,
            {
              strokeDasharray: () => paintedLength(path),
              strokeDashoffset: () => paintedLength(path),
            },
            0.12,
          );
          timeline.to(path, { strokeDashoffset: 0, duration: 0.6, ease: "power2.out" }, 0.12);
        }
        /*
          The settled study is a plain solid stroke. The dash exists only to be the
          draw's own bookkeeping, so it is cleared once the whole timeline has
          finished: whether the draw completed on its own, was skipped, settled for
          reduced motion, or was resized, no later state can leave a gap behind.
        */
      }
      timeline.fromTo(nodes, {
        opacity: 0,
        y: kind === "lifecycle" ? 12 : 24,
        x: kind === "boundaries" ? (index: number) => (index - 1.5) * 12 : 0,
        rotationX: kind === "compose" ? -12 : 0,
      }, {
        opacity: 1, x: 0, y: 0, rotationX: 0,
        duration: 0.8, stagger: kind === "lifecycle" ? 0.035 : 0.06,
        ease: "power3.out", immediateRender: false,
      }, 0);
      // Placed after every other child, so it really is the last thing the
      // timeline does.
      if (paths.length) timeline.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" }, ">");
      return { figure, timeline, played: false };
    });

    function settlePreview() {
      wipe?.kill();
      wipe = undefined;
      panels.forEach((panel, index) => {
        panel.hidden = index !== active;
        panel.removeAttribute("aria-hidden");
        gsap.set(panel, { clearProps: "clipPath,zIndex" });
      });
    }

    function select(next: number, animate: boolean) {
      if (next === active) return;
      const previous = active;
      settlePreview();
      active = next;
      rows.forEach((row, index) => row.toggleAttribute("data-active", index === active));
      const incoming = panels[active];
      incoming.hidden = false;
      if (!animate || motionQuery.matches) {
        settlePreview();
        return;
      }
      const outgoing = panels[previous];
      outgoing.hidden = false;
      outgoing.setAttribute("aria-hidden", "true");
      gsap.set(incoming, { zIndex: 1 });
      wipe = gsap.fromTo(incoming, {
        clipPath: next > previous ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
      }, {
        clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power2.inOut",
        onComplete: settlePreview,
      });
    }

    function update() {
      frame = 0;
      const delta = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      const box = host.getBoundingClientRect();
      if (stage.getClientRects().length && box.bottom > 0 && box.top < window.innerHeight) {
        // The last record crossing the reading line owns the preview. This
        // supports reverse scroll and jumps without storing scroll progress.
        const readingLine = window.innerHeight * 0.48;
        let next = 0;
        for (const [index, row] of rows.entries()) {
          if (row.getBoundingClientRect().top <= readingLine) next = index;
        }
        select(next, delta < window.innerHeight * 0.75);
      }
      for (const artwork of artworks) {
        if (artwork.played || !artwork.figure.getClientRects().length) continue;
        if (artwork.figure.getBoundingClientRect().bottom <= 0) {
          artwork.played = true;
          artwork.timeline.progress(1).pause();
        }
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const artwork = artworks.find((item) => item.figure === entry.target)!;
        if (!entry.isIntersecting || artwork.played) continue;
        artwork.played = true;
        if (motionQuery.matches) artwork.timeline.progress(1).pause();
        else artwork.timeline.play();
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    for (const artwork of artworks) observer.observe(artwork.figure);

    function syncPreference() {
      settlePreview();
      if (motionQuery.matches) {
        for (const artwork of artworks) {
          artwork.played = true;
          artwork.timeline.progress(1).pause();
        }
      }
      schedule();
    }

    function focusRecord(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>(".work-index > li");
      if (row) select(rows.indexOf(row), false);
    }

    function syncVisibility() {
      for (const artwork of artworks) {
        if (!artwork.played || artwork.timeline.progress() === 1) continue;
        if (document.hidden) artwork.timeline.pause();
        else artwork.timeline.resume();
      }
      if (document.hidden) settlePreview();
      else schedule();
    }

    const resizeObserver = new ResizeObserver(() => {
      settlePreview();
      schedule();
    });
    resizeObserver.observe(host);
    rows[0]?.setAttribute("data-active", "");
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    host.addEventListener("focusin", focusRecord);
    document.addEventListener("visibilitychange", syncVisibility);
    motionQuery.addEventListener("change", syncPreference);
    /*
      The controller is what makes the section's reserved geometry true, so it
      confirms itself to the pre-paint hold. It does not touch the reservation
      itself: the hold owns that, and only the hold can release it.
    */
    window.__workPreviewReady = true;
    syncPreference();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      wipe?.kill();
      for (const artwork of artworks) artwork.timeline.kill();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      host.removeEventListener("focusin", focusRecord);
      document.removeEventListener("visibilitychange", syncVisibility);
      motionQuery.removeEventListener("change", syncPreference);
    };
  });
</script>

<div class="work-layout" bind:this={host}>
  <div class="work-intro">
    <div class="work-heading">
      <SectionHeading
        index="01"
        label="Work"
        headingId="selected-evidence-heading"
        title="Look inside the work."
        intro="Three public repositories. Different systems, with the source material open to inspection."
      />
    </div>
    <!--
      The stage is the visual half of the reading index. Its panels name
      themselves, so the container carries no label of its own: an aria-label on a
      plain div is not exposed, and a named group here would only make a screen
      reader announce the same project twice.
    -->
    <div class="work-preview-stage">
      {#each projects as project, index}
        <div class="work-preview-panel" data-preview={project.id} hidden={index !== 0}>
          <ProjectPreview {project} />
        </div>
      {/each}
    </div>
    <p class="work-preview-note">Source-derived visuals. Not product screenshots.</p>
  </div>

  <ol class="work-index">
    {#each projects as project}
      <li data-reveal data-enter="right">
        <span class="reveal-rule" data-rule aria-hidden="true"></span>
        <article aria-labelledby={`${project.id}-heading`}>
          <p class="project-index" aria-hidden="true">{project.index}</p>
          <div class="project-body">
            <h3 id={`${project.id}-heading`}>{project.name}</h3>
            <p class="project-deck">{project.deck}</p>
            <div class="work-inline-preview"><ProjectPreview {project} /></div>
            <div class="project-structure" aria-label={project.structureLabel}>
              {#each project.structure as item}<span>{item}</span>{/each}
            </div>
            <p class="project-copy">{project.copy}</p>
            <div class="project-sources">
              <a class="project-link" href={project.href}>Source: {project.name} <span aria-hidden="true">↗</span></a>
              <a class="preview-reference" href={project.preview.href}>Preview reference: {project.preview.source} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </article>
      </li>
    {/each}
  </ol>
</div>

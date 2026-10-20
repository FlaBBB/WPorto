<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "../lib/portfolio";
  import ProjectPreview from "./ProjectPreview.svelte";
  import SectionHeading from "./SectionHeading.svelte";

  let { projects }: { projects: Project[] } = $props();
  let host: HTMLDivElement;

  /**
   * Native radios own the selection, including before hydration and without JS.
   * Hover only enhances that same state; it never owns the visitor's scroll.
   */
  onMount(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const panels = [...host.querySelectorAll<HTMLElement>(".work-project")];
    const HOVER_INTENT = 110;
    let hoverTimer = 0;

    function clearIntent() {
      window.clearTimeout(hoverTimer);
    }

    function select(panel: HTMLElement) {
      panel.querySelector<HTMLInputElement>(".work-choice")!.checked = true;
    }

    const listeners = panels.map((panel) => {
      const enter = (event: PointerEvent) => {
        if (!finePointer.matches || event.pointerType !== "mouse" || event.buttons) return;
        clearIntent();
        hoverTimer = window.setTimeout(() => {
          if (document.hidden || !finePointer.matches) return;
          // Never collapse notes or a source link under a keyboard visitor.
          const focused = document.activeElement;
          if (
            focused instanceof HTMLElement &&
            focused.matches("a, summary") &&
            host.contains(focused) &&
            !panel.contains(focused)
          ) return;
          host.dataset.input = "pointer";
          select(panel);
        }, HOVER_INTENT);
      };
      panel.addEventListener("pointerenter", enter);
      panel.addEventListener("pointerleave", clearIntent);
      return () => {
        panel.removeEventListener("pointerenter", enter);
        panel.removeEventListener("pointerleave", clearIntent);
      };
    });

    function focusRecord(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      clearIntent();
      if (target.matches(":focus-visible")) host.dataset.input = "keyboard";
      const panel = target.closest<HTMLElement>(".work-project");
      if (panel) select(panel);
    }

    function press() {
      clearIntent();
      host.dataset.input = "pointer";
    }

    function key() {
      clearIntent();
      host.dataset.input = "keyboard";
    }

    host.addEventListener("pointerdown", press);
    host.addEventListener("keydown", key);
    host.addEventListener("focusin", focusRecord);
    host.addEventListener("change", clearIntent);
    finePointer.addEventListener("change", clearIntent);
    document.addEventListener("visibilitychange", clearIntent);

    return () => {
      clearIntent();
      for (const remove of listeners) remove();
      host.removeEventListener("pointerdown", press);
      host.removeEventListener("keydown", key);
      host.removeEventListener("focusin", focusRecord);
      host.removeEventListener("change", clearIntent);
      finePointer.removeEventListener("change", clearIntent);
      document.removeEventListener("visibilitychange", clearIntent);
    };
  });
</script>

<div class="work-layout" data-input="keyboard" bind:this={host}>
  <div class="work-header">
    <div class="work-heading">
      <SectionHeading
        index="01"
        label="Work"
        headingId="selected-evidence-heading"
        title="Selected work."
      />
    </div>
    <p class="work-hint" id="work-gallery-hint">
      <span class="work-hover-hint">Hover to explore.</span>
      <span class="work-touch-hint">Choose a project to explore.</span>
      <span class="visually-hidden">Use the arrow keys to change projects.</span>
    </p>
  </div>

  <fieldset class="work-gallery" aria-describedby="work-gallery-hint">
    <legend class="visually-hidden">Selected work</legend>
    <ol class="work-panels">
      {#each projects as project, index}
        <li class="work-project">
          <article aria-labelledby={`${project.id}-heading`}>
            <input
              class="work-choice visually-hidden"
              type="radio"
              name="work-project"
              id={`${project.id}-choice`}
              value={project.id}
              aria-labelledby={`${project.id}-heading`}
              checked={index === 0}
            />
            <div class="work-project-head">
              <label class="work-project-select" for={`${project.id}-choice`}>
                <span class="project-index" aria-hidden="true">{project.index}</span>
                <span class="visually-hidden">Select {project.name}</span>
                <span class="work-project-mark" aria-hidden="true">+</span>
              </label>
              <h3 id={`${project.id}-heading`}>
                <label for={`${project.id}-choice`}>{project.name}</label>
              </h3>
            </div>
            <p class="project-deck">{project.deck}</p>
            <a class="project-link" href={project.href} aria-label={`Source: ${project.name}`}>
              <span>Source<span class="project-link-name">: {project.name}</span></span>
              <span aria-hidden="true">↗</span>
            </a>
            <div class="work-project-preview"><ProjectPreview {project} /></div>
            <div class="project-sources">
              <a class="preview-reference" href={project.preview.href} aria-label={`Preview reference: ${project.preview.source}`}>
                {project.preview.source} <span aria-hidden="true">↗</span>
              </a>
              <details class="project-notes">
                <summary>Project notes <span aria-hidden="true">+</span></summary>
                <div class="project-notes-body">
                  <p class="project-copy">{project.copy}</p>
                  <div class="project-structure" aria-label={project.structureLabel}>
                    {#each project.structure as item}<span>{item}</span>{/each}
                  </div>
                </div>
              </details>
            </div>
          </article>
        </li>
      {/each}
    </ol>
  </fieldset>
  <p class="work-preview-note">Source-derived visuals. Not product screenshots.</p>
</div>

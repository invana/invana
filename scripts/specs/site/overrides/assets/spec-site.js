/*
 * Diagram zoom for the spec site. Each mermaid diagram is wrapped in a frame with zoom in, zoom out, reset and full
 * screen buttons; the wheel (with Ctrl or ⌘) zooms and dragging pans. It transforms the diagram's host element, so it
 * works with Material's shadow-DOM rendering, and it frames diagrams as they render, instant navigation included.
 */
(() => {
  const STEP = 1.25;

  function frame(diagram) {
    if (diagram.parentElement?.classList.contains("spec-zoom")) return;
    const box = document.createElement("div");
    box.className = "spec-zoom";
    diagram.before(box);
    box.append(diagram);

    const view = { scale: 1, x: 0, y: 0 };
    // Material may swap the diagram's element when it renders; always transform the current one.
    const apply = () => {
      const current = box.querySelector(":scope > .mermaid");
      if (current) current.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    };
    const zoom = (factor, cx = box.clientWidth / 2, cy = box.clientHeight / 2) => {
      const next = Math.min(8, Math.max(0.2, view.scale * factor));
      view.x = cx - ((cx - view.x) * next) / view.scale;
      view.y = cy - ((cy - view.y) * next) / view.scale;
      view.scale = next;
      apply();
    };

    const bar = document.createElement("div");
    bar.className = "spec-zoom__bar";
    for (const [label, title, act] of [
      ["+", "Zoom in", () => zoom(STEP)],
      ["−", "Zoom out", () => zoom(1 / STEP)],
      ["1:1", "Reset", () => Object.assign(view, { scale: 1, x: 0, y: 0 }) && apply()],
      ["⤢", "Full screen", () => (document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen())],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", act);
      bar.append(b);
    }
    box.append(bar);

    box.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const r = box.getBoundingClientRect();
        zoom(e.deltaY < 0 ? STEP : 1 / STEP, e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
    box.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".spec-zoom__bar")) return;
      const start = { x: e.clientX - view.x, y: e.clientY - view.y };
      box.classList.add("is-panning");
      box.setPointerCapture(e.pointerId);
      const move = (m) => {
        view.x = m.clientX - start.x;
        view.y = m.clientY - start.y;
        apply();
      };
      const up = () => {
        box.classList.remove("is-panning");
        box.removeEventListener("pointermove", move);
      };
      box.addEventListener("pointermove", move);
      box.addEventListener("pointerup", up, { once: true });
    });
  }

  // Material renders each diagram later, replacing its <pre> with a <div>; frame the rendered ones as they appear.
  const run = () => {
    for (const d of document.querySelectorAll(".md-content div.mermaid")) frame(d);
  };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();

/*
 * A resizable left nav: drag the tree's right edge. The width lives in --spec-nav-width on <html> and is remembered
 * per browser; instant navigation swaps the sidebar, so the handle is re-added whenever it goes missing.
 */
(() => {
  const KEY = "spec-site.nav-width";
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) root.style.setProperty("--spec-nav-width", saved);
  } catch {}

  function handle(sidebar) {
    if (sidebar.querySelector(":scope > .spec-nav-resize")) return;
    const grip = document.createElement("div");
    grip.className = "spec-nav-resize";
    grip.title = "Drag to resize";
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      grip.classList.add("is-dragging");
      const rem = Number.parseFloat(getComputedStyle(root).fontSize);
      const left = sidebar.getBoundingClientRect().left;
      const move = (m) => {
        const width = Math.min(40, Math.max(12, (m.clientX - left) / rem));
        root.style.setProperty("--spec-nav-width", `${width.toFixed(1)}rem`);
      };
      const up = () => {
        grip.classList.remove("is-dragging");
        grip.removeEventListener("pointermove", move);
        try {
          localStorage.setItem(KEY, root.style.getPropertyValue("--spec-nav-width"));
        } catch {}
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up, { once: true });
    });
    sidebar.append(grip);
  }

  const run = () => {
    const sidebar = document.querySelector(".md-sidebar--primary");
    if (sidebar) handle(sidebar);
  };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();

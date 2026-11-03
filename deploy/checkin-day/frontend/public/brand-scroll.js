(() => {
  let frame = 0;
  const update = () => {
    frame = 0;
    const sidebar = document.querySelector(".sidebar-scroll");
    const hidden = window.scrollY > 48 || (sidebar && sidebar.scrollTop > 48);
    document.documentElement.classList.toggle("sidebar-logo-hidden", Boolean(hidden));
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("pageshow", schedule);
  window.addEventListener("popstate", schedule);
  schedule();
})();

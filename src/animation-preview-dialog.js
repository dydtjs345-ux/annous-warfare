// UI-only lifecycle. Loading/unloading the iframe cannot access Battle objects.
export function bindAnimationPreview({
  button,
  dialog,
  onOpen,
  onClose,
  path = "animation-preview.html",
  title = "USMC SE 전신 동작 미리보기",
}) {
  let opened = false;
  button.onclick = () => {
    if (opened) return;
    dialog.showModal();
    opened = true;
    onOpen();
    const frame = document.createElement("iframe");
    frame.title = title;
    frame.src = import.meta.env.BASE_URL + path;
    dialog.querySelector(".animation-preview-host").append(frame);
    dialog.querySelector("[data-preview-close]").focus();
  };
  dialog.querySelector("[data-preview-close]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    if (!opened) return;
    opened = false;
    dialog.querySelector("iframe")?.remove();
    onClose();
    button.focus();
  });
}

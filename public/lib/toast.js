const host = document.querySelector('[data-mount="toast"]');

export function toast(msg, kind = "positive") {
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const modalFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export const focusableModalElements = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(modalFocusableSelector)).filter(
    (element) => element.tabIndex !== -1 && element.getClientRects().length > 0
  );

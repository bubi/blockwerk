import { useEffect, useEffectEvent, useState, type RefObject } from "react";

/** Trap focus in the foremost modal and temporarily make its background inert. */
export function useModalFocus(
  overlay: RefObject<HTMLDivElement | null>,
  dialog: RefObject<HTMLDivElement | null>,
  onCancel: () => void,
) {
  const [previous] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const cancel = useEffectEvent(onCancel);
  useEffect(() => {
    const background: Array<{ element: HTMLElement; inert: boolean }> = [];
    let branch: HTMLElement | null = overlay.current;
    while (branch?.parentElement) {
      for (const sibling of branch.parentElement.children)
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.toggleAttribute("inert", true);
        }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const controller = new AbortController();
    const foremost = () =>
      Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) ===
      dialog.current;
    const focusables = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ) ?? [],
      ).filter(
        (element) =>
          !element.matches(":disabled") &&
          !element.closest("[inert]") &&
          element.getClientRects().length > 0,
      );
    if (dialog.current && !dialog.current.contains(document.activeElement))
      focusables()[0]?.focus();
    document.addEventListener(
      "focusin",
      (event) => {
        if (
          foremost() &&
          dialog.current &&
          !dialog.current.contains(event.target as Node)
        )
          focusables().at(-1)?.focus();
      },
      { signal: controller.signal },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (!foremost()) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
        if (event.key === "Tab") {
          const elements = focusables();
          const first = elements[0];
          const last = elements.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      },
      { signal: controller.signal },
    );
    return () => {
      controller.abort();
      background.forEach(({ element, inert }) => {
        element.toggleAttribute("inert", inert);
      });
      if (previous?.isConnected) previous.focus();
      else
        document.querySelector<HTMLButtonElement>(".primary-action")?.focus();
    };
  }, [overlay, dialog, previous]);
}

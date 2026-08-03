import { forwardRef, useLayoutEffect, useRef } from "react";
import styles from "./GrowingTextarea.module.css";

interface GrowingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  /** Combobox wiring (design-system 6) for autocomplete fields. */
  combobox?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaActiveDescendant?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
}

/**
 * Das gemeinsame Feld-Bauteil: ein `<textarea rows="1">`, das mitwächst statt
 * waagerecht zu scrollen. Die Höhe wird nach jeder Änderung aus scrollHeight
 * gesetzt — synchron vor dem Zeichnen (Layout-Effekt) und zusätzlich bei
 * input. Enter erzeugt hier nie einen Umbruch; die Zeilenlogik entscheidet
 * darüber. Die Referenz wird nach außen durchgereicht, weil die Eingabezeile
 * eine hält.
 */
export const GrowingTextarea = forwardRef<
  HTMLTextAreaElement,
  GrowingTextareaProps
>(function GrowingTextarea(
  {
    value,
    onChange,
    className,
    placeholder,
    ariaLabel,
    id,
    combobox,
    ariaExpanded,
    ariaControls,
    ariaActiveDescendant,
    onKeyDown,
    onKeyUp,
    onClick,
  },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(resize, [value]);

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={1}
      id={id}
      className={`${styles.field} ${className ?? ""}`}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      role={combobox ? "combobox" : undefined}
      aria-expanded={combobox ? ariaExpanded : undefined}
      aria-controls={combobox ? ariaControls : undefined}
      aria-activedescendant={combobox ? ariaActiveDescendant : undefined}
      onChange={(event) => {
        resize();
        onChange(event.target.value);
      }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClick={onClick}
    />
  );
});

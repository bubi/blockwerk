import styles from "./Mark.module.css";

interface MarkProps {
  size?: number;
  tone?: "color" | "ink" | "muted";
}

/**
 * Das Blockwerk-Zeichen — eine Blockkarte, von links gelesen: der
 * Datumsrücken, zwei Notizzeilen, ein erledigter Task. Der Haken ist das
 * einzige Schrägelement und trägt die Wiedererkennbarkeit; er wird nicht
 * „begradigt". Inline-SVG, damit es die Farbvariablen der Anwendung erbt
 * und scharf bleibt. `aria-hidden`, weil daneben immer die Wortmarke oder
 * ein Seitentitel steht — das Zeichen allein ist nie die einzige
 * Information.
 */
export function Mark({ size = 26, tone = "color" }: MarkProps) {
  const plate =
    tone === "muted"
      ? "var(--green-soft)"
      : tone === "ink"
        ? "var(--text)"
        : "var(--green)";
  const ink = tone === "muted" ? "var(--green-dk)" : "#fff";
  return (
    <svg
      className={styles.mark}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="58" height="58" rx="15" fill={plate} />
      <g fill={ink}>
        <rect x="16.5" y="18" width="5" height="28" rx="2.5" />
        <rect x="27.5" y="19" width="20.5" height="5" rx="2.5" />
        <rect x="27.5" y="28" width="11" height="5" rx="2.5" />
      </g>
      <path
        d="M28.5 40 L32 43.5 L43 32.5"
        fill="none"
        stroke={ink}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

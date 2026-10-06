import { Fragment } from "react";
import { AlertTriangle } from "lucide-react";
import type { MetaToken } from "@/lib/role-meta";

/**
 * The sub-line under a company and role: location, level, pay.
 *
 * One component for the queue card, the pipeline row, the passed row and the panel,
 * because the four used to render the same three fields four different ways — and the
 * panel's version read the raw columns, so it printed an un-shortened location and the
 * literal "Not specified" where every card printed nothing.
 *
 * Archivo with tabular figures, not mono: these numbers sit inline in a phrase
 * ("5d old", "$169–303k"), and mono is for numbers in a column (STYLE_GUIDE 3.1).
 */
export function MetaLine({ tokens }: { tokens: MetaToken[] }) {
  if (tokens.length === 0) return null;
  return (
    <span className="truncate tabular-nums">
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-fg-4 mx-1">·</span>}
          <span
            title={t.title}
            className={[
              t.tone ?? "",
              t.guessed ? "underline decoration-dotted decoration-fg-4 underline-offset-2" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* An alarm token (a posting 30+ days old) carries a glyph as well as its
                number: a semantic colour is never the only signal. */}
            {t.tone?.includes("text-alarm") && (
              <AlertTriangle size={12} strokeWidth={1.5} absoluteStrokeWidth className="inline -mt-0.5 mr-0.5" />
            )}
            {t.text}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

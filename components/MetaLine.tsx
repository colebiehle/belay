import { Fragment } from "react";
import type { MetaToken } from "@/lib/role-meta";

/**
 * The sub-line under a company and role: location, level, pay.
 *
 * One component for the queue card, the pipeline row, the passed row and the panel,
 * because the four used to render the same three fields four different ways — and the
 * panel's version read the raw columns, so it printed an un-shortened location and the
 * literal "Not specified" where every card printed nothing.
 */
export function MetaLine({ tokens }: { tokens: MetaToken[] }) {
  if (tokens.length === 0) return null;
  return (
    <span className="truncate">
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-zinc-700"> · </span>}
          <span
            title={t.title}
            className={[
              t.tone ?? "",
              t.guessed ? "underline decoration-dotted decoration-zinc-700 underline-offset-2" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t.text}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

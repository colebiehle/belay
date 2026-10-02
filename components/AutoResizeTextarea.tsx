"use client";

import { TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  value: string;
};

/**
 * Textarea that grows with its content. Sets height to scrollHeight on every value change.
 * Sets overflow:hidden so internal scroll never appears.
 */
export function AutoResizeTextarea({ value, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...rest}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { SaveState } from "@/components/SaveStatus";

type UseAutoSaveOptions<T> = {
  delay?: number;
  enabled: boolean;
  save: (value: T) => Promise<void>;
  skipInitial?: boolean;
  value: T;
};

export function useAutoSave<T>({
  delay = 500,
  enabled,
  save,
  skipInitial = false,
  value,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveState>("idle");
  const saveRef = useRef(save);
  const skippedInitial = useRef(false);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled) return;
    if (skipInitial && !skippedInitial.current) {
      skippedInitial.current = true;
      return;
    }

    let active = true;
    const statusTimeout = window.setTimeout(() => {
      if (active) setStatus("saving");
    }, 0);

    const timeout = window.setTimeout(async () => {
      try {
        await saveRef.current(value);
        if (active) setStatus("saved");
      } catch (error) {
        console.error(error);
        if (active) setStatus("error");
      }
    }, delay);

    return () => {
      active = false;
      window.clearTimeout(statusTimeout);
      window.clearTimeout(timeout);
    };
  }, [delay, enabled, skipInitial, value]);

  return status;
}

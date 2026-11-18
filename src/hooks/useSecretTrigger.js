import { useEffect, useRef } from "react";

const WORD = "admin";

const isTextField = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Opens the admin panel when "admin" is typed in order anywhere on a desktop page.
 * Form fields are ignored so editing content can't accidentally reopen/close it.
 */
export default function useSecretTrigger(onTrigger) {
  const callback = useRef(onTrigger);
  useEffect(() => {
    callback.current = onTrigger;
  });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    let coarse = mq.matches;
    let buffer = "";

    const onKeyDown = (event) => {
      if (coarse || event.metaKey || event.ctrlKey || event.altKey || isTextField(event.target)) return;
      const key = event.key.toLowerCase();
      if (!/^[a-z]$/.test(key)) {
        buffer = "";
        return;
      }
      buffer = (buffer + key).slice(-WORD.length);
      if (buffer === WORD) {
        buffer = "";
        callback.current?.();
      }
    };

    const onMediaChange = (event) => {
      coarse = event.matches;
      buffer = "";
    };

    document.addEventListener("keydown", onKeyDown);
    mq.addEventListener?.("change", onMediaChange);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener?.("change", onMediaChange);
    };
  }, []);
}

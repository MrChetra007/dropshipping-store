"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { NAVIGATION_START_EVENT } from "@/lib/navigation-events";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "done";

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [phase, setPhase] = useState<Phase>("idle");
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousKey = useRef(locationKey);
  const pending = useRef(false);

  useEffect(() => {
    const begin = () => {
      pending.current = true;

      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }

      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
      }

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      showTimer.current = setTimeout(() => {
        if (pending.current) {
          setPhase("loading");
        }
      }, 120);

      safetyTimer.current = setTimeout(() => {
        pending.current = false;
        setPhase((current) => (current === "loading" ? "done" : current));
      }, 15000);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);

      if (url.origin !== window.location.origin) {
        return;
      }

      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
    };

    window.addEventListener(NAVIGATION_START_EVENT, begin);
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, begin);
      document.removeEventListener("click", onClick);

      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }

      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
      }

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousKey.current === locationKey) {
      return;
    }

    previousKey.current = locationKey;
    pending.current = false;

    if (showTimer.current) {
      clearTimeout(showTimer.current);
    }

    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
    }

    setPhase((current) => (current === "loading" ? "done" : current));
  }, [locationKey]);

  useEffect(() => {
    if (phase !== "done") {
      return;
    }

    resetTimer.current = setTimeout(() => setPhase("idle"), 350);

    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, [phase]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        aria-hidden
        className={cn(
          "h-full bg-zinc-900 transition-all dark:bg-zinc-100",
          phase === "loading" && "w-[82%] opacity-100 duration-[9000ms] ease-out",
          phase === "done" && "w-full opacity-0 duration-300 ease-out",
          phase === "idle" && "w-0 opacity-0 duration-150",
        )}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {phase === "loading" ? "Loading page…" : ""}
      </span>
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}

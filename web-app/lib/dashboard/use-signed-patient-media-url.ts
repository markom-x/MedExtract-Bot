"use client";

import { useEffect, useState } from "react";

import { createPatientMediaSignedUrl } from "@/lib/actions/patient-media";

type State =
  | { status: "idle"; src: null; error: null }
  | { status: "loading"; src: null; error: null }
  | { status: "ready"; src: string; error: null }
  | { status: "error"; src: null; error: string };

function initialStateForPath(path: string | null | undefined): State {
  const p = path?.trim() || null;
  if (!p) return { status: "idle", src: null, error: null };
  if (/^https?:\/\//i.test(p)) return { status: "ready", src: p, error: null };
  return { status: "loading", src: null, error: null };
}

/** Risolve `url_media` (path relativo o URL legacy) in `src` per `<audio>` / `<img>` / link. */
export function useSignedPatientMediaUrl(path: string | null | undefined) {
  const [state, setState] = useState<State>(() => initialStateForPath(path));

  useEffect(() => {
    const p = path?.trim() || null;
    if (!p) {
      setState({ status: "idle", src: null, error: null });
      return;
    }
    if (/^https?:\/\//i.test(p)) {
      setState({ status: "ready", src: p, error: null });
      return;
    }

    setState({ status: "loading", src: null, error: null });
    let cancelled = false;

    void createPatientMediaSignedUrl(p, 3600).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setState({ status: "ready", src: res.signedUrl, error: null });
      } else {
        setState({ status: "error", src: null, error: res.message });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return {
    src: state.status === "ready" ? state.src : null,
    loading: state.status === "loading",
    error: state.status === "error" ? state.error : null,
    idle: state.status === "idle",
  };
}

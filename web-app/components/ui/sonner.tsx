"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-slate-200 bg-white text-slate-900 shadow-md",
          title: "font-semibold text-slate-900",
          description: "text-slate-600",
          success: "border-emerald-200",
          error: "border-red-200",
        },
      }}
      {...props}
    />
  );
}

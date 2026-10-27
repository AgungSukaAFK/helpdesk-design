"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TopbarIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Jadi `title` + `aria-label`. */
  label: string;
  /** Angka di badge merah; 0/undefined = tanpa badge. */
  badge?: number;
  asChild?: boolean;
};

/** Dasar semua tombol ikon di top bar. */
export const TopbarIconButton = React.forwardRef<HTMLButtonElement, TopbarIconButtonProps>(
  ({ label, badge, asChild = false, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const count = badge && badge > 0 ? badge : 0;

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        title={label}
        aria-label={count ? `${label} (${count} baru)` : label}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          // Area tap diperluas 2px tiap sisi → 36px efektif di mobile.
          "relative size-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground sm:size-9",
          "after:absolute after:-inset-0.5 after:rounded-full after:content-['']",
          "data-[state=open]:bg-accent data-[state=open]:text-foreground",
          "[&_svg]:size-[1.125rem]",
          className,
        )}
        {...props}
      >
        <Slottable>{children}</Slottable>
        {count > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-background"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Comp>
    );
  },
);
TopbarIconButton.displayName = "TopbarIconButton";

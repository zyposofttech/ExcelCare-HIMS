"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// ChatGPT-like buttons: flatter, cleaner, and consistent across dark/light.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-xc-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-xc-accent text-white shadow-elev-1 hover:bg-xc-accent2 active:opacity-95",
        secondary:
          "bg-xc-panel text-xc-text border border-xc-border hover:bg-[rgb(var(--xc-hover-rgb)/0.04)]",
        outline:
          "border border-xc-border bg-transparent text-xc-text hover:bg-[rgb(var(--xc-hover-rgb)/0.06)]",
        ghost: "bg-transparent text-xc-text hover:bg-[rgb(var(--xc-hover-rgb)/0.06)]",
        destructive: "bg-xc-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        iconSm: "h-8 w-8 p-0",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

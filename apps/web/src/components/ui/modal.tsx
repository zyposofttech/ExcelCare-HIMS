"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  className?: string;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "lg",
  className,
}: ModalProps) {
  const maxW =
    size === "sm"
      ? "max-w-md"
      : size === "md"
        ? "max-w-xl"
        : size === "xl"
          ? "max-w-5xl"
          : "max-w-3xl";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // overlay click, ESC, close button
        if (!v) onClose();
      }}
    >
      <DialogContent
        className={cn(
          maxW,
          "w-[calc(100vw-2rem)]",
          "max-h-[90vh] overflow-hidden p-0",
          className
        )}
      >
        <div className="border-b border-zc-border px-5 py-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-zc-border bg-zc-card px-5 py-4">
            <DialogFooter className="mt-0">{footer}</DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

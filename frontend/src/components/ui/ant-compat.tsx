import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Modal({
  open,
  onCancel,
  footer,
  width,
  title,
  children,
}: {
  open?: boolean;
  onCancel?: () => void;
  footer?: ReactNode;
  width?: number;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel?.(); }}>
      <DialogContent style={width ? { maxWidth: width } : undefined}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  );
}

export function Popconfirm({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  okText,
  cancelText,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  okButtonProps?: Record<string, unknown>;
  placement?: string;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            {okText ?? "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function HoverPopover({
  content,
  title,
  trigger = "hover",
  placement = "top",
  children,
}: {
  content?: ReactNode;
  title?: ReactNode;
  trigger?: "hover" | "click";
  placement?: "top" | "bottom";
  children?: ReactNode;
}) {
  const position = placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  if (trigger === "click") {
    return <span className="inline-flex">{children}</span>;
  }
  return (
    <span className="group relative inline-flex">
      {children}
      <span className={`pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg group-hover:block ${position}`}>
        {title ? <span className="mb-1 block font-medium">{title}</span> : null}
        {content}
      </span>
    </span>
  );
}

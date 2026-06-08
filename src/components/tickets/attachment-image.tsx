"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AttachmentImageProps {
  src: string;
  alt: string;
  /** Classes applied to the clickable thumbnail image. */
  className?: string;
}

/**
 * A clickable image thumbnail that opens a full-size preview in a dialog.
 * Used for both pending reply attachments and images in the message thread.
 */
export function AttachmentImage({ src, alt, className }: AttachmentImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block cursor-zoom-in overflow-hidden rounded-lg"
        aria-label={`Pratinjau ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={cn("object-cover", className)} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92vw] border-0 bg-transparent p-0 ring-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

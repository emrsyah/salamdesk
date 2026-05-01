"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RiSendPlane2Line, RiLockLine, RiChatQuoteLine, RiListCheck } from "@remixicon/react";
import { sendReplyAction } from "@/actions/messages.actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface TicketReplyBoxProps {
  ticketId: string;
  moduleId?: string | null;
  quickReplies?: { id: string; label: string; content: string }[];
  onReplySent?: () => void;
}

export function TicketReplyBox({ ticketId, moduleId, quickReplies = [], onReplySent }: TicketReplyBoxProps) {
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await sendReplyAction({
        ticketId,
        content,
        isInternalNote: isInternal,
      });
      setContent("");
      onReplySent?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6 pt-0 bg-background border-t">
      <div className="max-w-4xl mx-auto py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="internal-mode"
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              <Label htmlFor="internal-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                {isInternal ? (
                  <>
                    <RiLockLine className="size-3.5 text-yellow-600" />
                    Catatan Internal
                  </>
                ) : (
                  <>
                    <RiSendPlane2Line className="size-3.5 text-blue-600" />
                    Balas Reporter
                  </>
                )}
              </Label>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                <RiChatQuoteLine className="size-3.5" />
                Quick Reply
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Pilih Template</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickReplies.map((qr) => (
                <DropdownMenuItem
                  key={qr.id}
                  onClick={() => setContent(qr.content)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="font-medium">{qr.label}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{qr.content}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-blue-600 font-medium justify-center">
                Atur Quick Reply
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative group">
          <Textarea
            placeholder={isInternal ? "Tulis catatan internal (hanya terlihat oleh tim)..." : "Tulis balasan untuk reporter..."}
            className={`min-h-[120px] resize-none pr-12 transition-all duration-200 focus-visible:ring-offset-0 ${
              isInternal
                ? "bg-yellow-50/20 border-yellow-200 focus-visible:ring-yellow-400"
                : "bg-muted/30 focus-visible:ring-blue-400"
            }`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            className={`absolute bottom-3 right-3 size-8 transition-all ${
              isInternal
                ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } ${!content.trim() ? "opacity-0 scale-90 translate-y-1" : "opacity-100 scale-100 translate-y-0"}`}
            disabled={!content.trim() || isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <div className="size-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
            ) : (
              <RiSendPlane2Line className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-2 flex justify-between items-center text-[10px] text-muted-foreground px-1">
          <span>{isInternal ? "Hanya tim yang dapat melihat pesan ini." : "Pesan ini akan dikirim ke reporter."}</span>
          <span>Tekan <kbd className="font-sans border px-1 rounded bg-muted/50">Ctrl + Enter</kbd> untuk kirim</span>
        </div>
      </div>
    </div>
  );
}

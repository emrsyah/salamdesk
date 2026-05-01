"use client";

import { useState } from "react";
import { TicketDetailData } from "./ticket-detail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RiMessage3Line, RiLockLine } from "@remixicon/react";

interface TicketMessageThreadProps {
  messages: TicketDetailData["messages"];
}

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function TicketMessageThread({ messages }: TicketMessageThreadProps) {
  const publicMessages = messages.filter((m) => !m.isInternalNote);
  const internalNotes = messages.filter((m) => m.isInternalNote);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="thread" className="w-full">
          <TabsList className="mb-6 bg-muted/50 p-1">
            <TabsTrigger value="thread" className="gap-2 px-4">
              <RiMessage3Line className="size-4" />
              Percakapan ({publicMessages.length})
            </TabsTrigger>
            <TabsTrigger value="internal" className="gap-2 px-4">
              <RiLockLine className="size-4" />
              Catatan Internal ({internalNotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="thread" className="space-y-4 outline-none">
            {publicMessages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 border-2 border-dashed rounded-xl">
                Belum ada pesan publik.
              </div>
            ) : (
              publicMessages.map((msg) => (
                <MessageCard key={msg.id} msg={msg} />
              ))
            )}
          </TabsContent>

          <TabsContent value="internal" className="space-y-4 outline-none">
            {internalNotes.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 border-2 border-dashed rounded-xl">
                Belum ada catatan internal.
              </div>
            ) : (
              internalNotes.map((msg) => (
                <MessageCard key={msg.id} msg={msg} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MessageCard({ msg }: { msg: TicketDetailData["messages"][0] }) {
  const isAi = msg.senderType === "ai_bot";
  const isSystem = msg.senderType === "system";

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${
        msg.isInternalNote
          ? "bg-yellow-50/40 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900"
          : isAi
            ? "bg-purple-50/40 border-purple-200 dark:bg-purple-950/20"
            : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {isAi ? "AI Assistant" : isSystem ? "Sistem" : (msg.sender?.name ?? "Anonim")}
          </span>
          {isAi && (
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Bot
            </span>
          )}
          {msg.isInternalNote && (
            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Internal
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {formatTime(msg.createdAt)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
        {msg.content}
      </p>
    </div>
  );
}

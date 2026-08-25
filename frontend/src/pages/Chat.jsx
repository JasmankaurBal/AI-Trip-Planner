import React from "react";
import ChatPanel from "../components/chat/ChatPanel";

export default function Chat() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-ink">COCO Chat</h1>
      <p className="mt-1 text-ink-soft">Your general travel companion. For trip-specific help, open a trip and use its chat tab.</p>
      <div className="card mt-6 flex h-[70vh] flex-col overflow-hidden p-0">
        <ChatPanel className="h-full" />
      </div>
    </div>
  );
}

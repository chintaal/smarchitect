"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudio } from "@/lib/store";
import { PropertyPanel } from "./property-panel";
import { AiChatPanel } from "./ai-chat-panel";
import { CompliancePanel } from "./compliance-panel";
import { SlidersHorizontal, MessageSquare, ShieldCheck } from "lucide-react";

export function RightPanel() {
  const [tab, setTab] = React.useState("properties");
  const selectedNodeId = useStudio((s) => s.selectedNodeId);
  const selectedEdgeId = useStudio((s) => s.selectedEdgeId);

  // Jump to Properties when the user selects something on the canvas.
  React.useEffect(() => {
    if (selectedNodeId || selectedEdgeId) setTab("properties");
  }, [selectedNodeId, selectedEdgeId]);

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-card/40">
      <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
        <div className="border-b border-border p-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="properties">
              <SlidersHorizontal className="size-3.5" /> <span className="hidden lg:inline">Properties</span>
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="size-3.5" /> <span className="hidden lg:inline">AI Chat</span>
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <ShieldCheck className="size-3.5" /> <span className="hidden lg:inline">Comply</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="properties" className="min-h-0 flex-1 data-[state=inactive]:hidden">
          <PropertyPanel />
        </TabsContent>
        <TabsContent value="chat" className="min-h-0 flex-1 data-[state=inactive]:hidden">
          <AiChatPanel />
        </TabsContent>
        <TabsContent value="compliance" className="min-h-0 flex-1 data-[state=inactive]:hidden">
          <CompliancePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

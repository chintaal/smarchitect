"use client";

import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import { StudioTopbar } from "@/components/studio/studio-topbar";
import { Palette } from "@/components/studio/palette";
import { RightPanel } from "@/components/studio/right-panel";
import { BottomBar } from "@/components/studio/bottom-bar";

// React Flow measures nodes against the live DOM — render it client-only to
// avoid SSR id mismatches and guarantee a clean measurement pass.
const Canvas = dynamic(() => import("@/components/studio/canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-canvas" />,
});

export default function StudioPage() {
  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 flex-col">
        <StudioTopbar />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <div className="relative min-w-0 flex-1">
            <Canvas />
          </div>
          <RightPanel />
        </div>
        <BottomBar />
      </div>
    </ReactFlowProvider>
  );
}

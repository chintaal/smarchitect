"use client";

import { create } from "zustand";

interface UiState {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  /** Currently selected LiteLLM model id for the topbar selector. */
  activeModel: string;
  setActiveModel: (id: string) => void;
}

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  activeModel: "auto",
  setActiveModel: (activeModel) => set({ activeModel }),
}));

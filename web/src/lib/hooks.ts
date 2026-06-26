"use client";

import { useMemo } from "react";
import { useStudio } from "./store";
import { validateGraph } from "./crg/validation";
import { summarizeCost, compareProviders } from "./crg/cost";
import { evaluateFramework, getFramework } from "./crg/compliance";

export function useValidation() {
  const graph = useStudio((s) => s.graph);
  return useMemo(() => validateGraph(graph), [graph]);
}

export function useCostSummary() {
  const graph = useStudio((s) => s.graph);
  return useMemo(() => summarizeCost(graph), [graph]);
}

export function useProviderComparison() {
  const graph = useStudio((s) => s.graph);
  return useMemo(() => compareProviders(graph), [graph]);
}

export function useLensResult() {
  const graph = useStudio((s) => s.graph);
  const lensId = useStudio((s) => s.lensFrameworkId);
  return useMemo(() => {
    if (!lensId) return null;
    const fw = getFramework(lensId);
    return fw ? evaluateFramework(fw, graph) : null;
  }, [graph, lensId]);
}

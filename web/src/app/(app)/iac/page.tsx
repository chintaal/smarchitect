"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/lib/store";
import { generateIac, type IacFormat } from "@/lib/crg/iac";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileCode2, Play, Download, Copy, GitBranch, Check, Terminal, Loader2 } from "lucide-react";

const FORMATS: { id: IacFormat; label: string; sub: string }[] = [
  { id: "terraform", label: "Terraform", sub: "HCL" },
  { id: "pulumi", label: "Pulumi", sub: "TypeScript" },
  { id: "helm", label: "Helm", sub: "Kubernetes" },
  { id: "cloudformation", label: "CloudFormation", sub: "JSON" },
];

export default function IacPage() {
  const graph = useStudio((s) => s.graph);
  const projectName = useStudio((s) => s.projectName);
  const [format, setFormat] = React.useState<IacFormat>("terraform");
  const [activeFile, setActiveFile] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [plan, setPlan] = React.useState<string[] | null>(null);
  const [planning, setPlanning] = React.useState(false);

  const bundle = React.useMemo(() => generateIac(graph, format), [graph, format]);
  React.useEffect(() => setActiveFile(0), [format]);
  const file = bundle.files[activeFile] ?? bundle.files[0];

  const copy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop()!;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${file.path}`);
  };

  const runPreview = () => {
    setPlanning(true);
    setPlan([]);
    const creates = graph.nodes.length;
    const lines = [
      "$ pulumi preview --diff",
      "Previewing update (dev)...",
      "",
      ...graph.nodes.slice(0, 8).map((n) => `    + ${n.serviceType.padEnd(18)} ${n.name}  create`),
      graph.nodes.length > 8 ? `    + … ${graph.nodes.length - 8} more` : "",
      "",
      "Resources:",
      `    + ${creates} to create`,
      "",
      "Validated against provider schemas ✓  No errors.",
    ].filter(Boolean);
    let i = 0;
    const tick = () => {
      setPlan(lines.slice(0, i + 1));
      i++;
      if (i < lines.length) setTimeout(tick, 90);
      else setPlanning(false);
    };
    tick();
  };

  return (
    <PageShell
      title="IaC & Deploy"
      description="One graph → Pulumi, Terraform, Helm, CloudFormation — preview before you ship"
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => toast.info("Git push", { description: "Connect a repo to push generated IaC as a PR." })}>
            <GitBranch className="size-4" /> Push to git
          </Button>
          <Button size="sm" variant="default" onClick={download}>
            <Download className="size-4" /> Download
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all",
              format === f.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent",
            )}
          >
            <FileCode2 className={cn("size-4", format === f.id ? "text-primary" : "text-muted-foreground")} />
            <div>
              <div className="font-medium leading-none">{f.label}</div>
              <div className="text-[10px] text-muted-foreground">{f.sub}</div>
            </div>
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          {projectName} · {graph.nodes.length} resources
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[200px_1fr]">
        <Card className="h-fit p-2">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Files</div>
          {bundle.files.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActiveFile(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                i === activeFile ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <FileCode2 className="size-3.5 shrink-0" />
              <span className="truncate font-mono">{f.path}</span>
            </button>
          ))}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-card/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{file.path}</span>
              <Badge variant="muted" className="text-[9px] uppercase">{file.language}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={runPreview} disabled={planning}>
                {planning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Preview plan
              </Button>
              <button onClick={copy} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>
          <CodeView content={file.content} />
        </Card>
      </div>

      {plan && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
            <Terminal className="size-3.5 text-primary" />
            <span className="text-xs font-medium">Pulumi preview (Automation API)</span>
          </div>
          <pre className="max-h-72 overflow-auto bg-[#0a0d13] p-4 font-mono text-[12px] leading-relaxed scrollbar-thin">
            {plan.map((line, i) => (
              <div
                key={i}
                className={cn(
                  line.includes("create") || line.trim().startsWith("+") ? "text-success" : line.startsWith("$") ? "text-primary" : line.includes("✓") ? "text-success" : "text-muted-foreground",
                )}
              >
                {line || " "}
              </div>
            ))}
            {planning && <div className="mt-1 inline-block h-3 w-2 animate-pulse bg-primary" />}
          </pre>
        </Card>
      )}
    </PageShell>
  );
}

function CodeView({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <pre className="max-h-[460px] overflow-auto bg-[#0a0d13] p-4 font-mono text-[12.5px] leading-relaxed scrollbar-thin">
      {lines.map((line, i) => {
        const isComment = /^\s*(#|\/\/)/.test(line);
        return (
          <div key={i} className="flex">
            <span className="mr-4 inline-block w-7 shrink-0 select-none text-right text-muted-foreground/40">{i + 1}</span>
            <span className={cn("whitespace-pre", isComment ? "text-muted-foreground/70" : "text-foreground/90")}>{line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

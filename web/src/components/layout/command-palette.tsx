"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav";
import { TEMPLATES } from "@/lib/crg/templates";
import { useStudio } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { Plus, Sparkles, LibraryBig } from "lucide-react";

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const router = useRouter();
  const loadTemplate = useStudio((s) => s.loadTemplate);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUi.getState().commandOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search, navigate, or talk to your architecture…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/studio")}>
            <Sparkles /> New architecture from a prompt
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}>
            <Plus /> New project
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Start from a template">
          {TEMPLATES.map((t) => (
            <CommandItem
              key={t.id}
              onSelect={() => {
                loadTemplate(t.id);
                go("/studio");
              }}
            >
              <LibraryBig /> {t.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

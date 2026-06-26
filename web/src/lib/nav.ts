import {
  LayoutDashboard,
  PenTool,
  Plug,
  Search,
  ShieldCheck,
  Wallet,
  Package,
  LibraryBig,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Projects grid, recent activity, cost summary" },
  { label: "Design Studio", href: "/studio", icon: PenTool, description: "The canvas — builder, AI, and compliance lens" },
  { label: "Connections", href: "/connections", icon: Plug, description: "Link AWS / Azure / GCP accounts; import TF state" },
  { label: "Inventory", href: "/inventory", icon: Search, description: "Imported resources, drift, multi-account view" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, description: "Overlays, audit reports, framework status" },
  { label: "Cost", href: "/cost", icon: Wallet, description: "Estimates, comparisons, what-if, LLM spend" },
  { label: "IaC & Deploy", href: "/iac", icon: Package, description: "Generated code, preview/plan, export, git push" },
  { label: "Templates", href: "/templates", icon: LibraryBig, description: "Reference architectures to start from" },
  { label: "Settings", href: "/settings", icon: Settings, description: "Models (LiteLLM config), budgets, providers" },
];

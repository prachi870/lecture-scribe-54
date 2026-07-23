import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "./lectures";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ALIP" }, { name: "description", content: "Track study time, retention, and weak topics." }] }),
  component: () => <ComingSoon title="Analytics" description="Track study time, retention, and weak topics." icon={BarChart3} />,
});

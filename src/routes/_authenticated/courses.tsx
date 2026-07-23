import { createFileRoute } from "@tanstack/react-router";
import { Library } from "lucide-react";
import { ComingSoon } from "./lectures";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({ meta: [{ title: "Courses — ALIP" }, { name: "description", content: "Organize lectures by course." }] }),
  component: () => <ComingSoon title="Courses" description="Group your lectures by subject and semester." icon={Library} />,
});

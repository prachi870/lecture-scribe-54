import { createFileRoute } from "@tanstack/react-router";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lectures")({
  head: () => ({
    meta: [
      { title: "Lectures — ALIP" },
      { name: "description", content: "All your recorded and uploaded lectures." },
    ],
  }),
  component: Placeholder,
});

function Placeholder() {
  return <ComingSoon title="Lectures" description="Recording and upload flow ships in Phase 2." icon={Mic} />;
}

export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Mic;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}

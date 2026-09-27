import { createFileRoute } from "@tanstack/react-router";
import { DecibelApp } from "@/components/decibel/shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DecibelApp />;
}

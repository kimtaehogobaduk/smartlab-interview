import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rooms/$roomId")({
  component: () => <Outlet />,
});

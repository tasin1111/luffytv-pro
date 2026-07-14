import type { Metadata } from "next";
import AdminApp from "@/components/admin/admin-app";

export const metadata: Metadata = {
  title: "Admin Console",
  robots: { index: false, follow: false },
};

export default function AdminRoute() {
  return <AdminApp />;
}

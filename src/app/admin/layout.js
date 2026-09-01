import AuthShell from "@/components/auth/AuthShell";

export const metadata = {
  title: "Admin Console",
};

export default function AdminLayout({ children }) {
  return <AuthShell>{children}</AuthShell>;
}
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return ok({ user: null }, 200);
  }
  return ok({ user });
}

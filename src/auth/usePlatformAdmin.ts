import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { meuEstadoPlatform } from "@/lib/platform.functions";
import { useAuth } from "./AuthProvider";

export function usePlatformAdmin() {
  const { user } = useAuth();
  const fn = useServerFn(meuEstadoPlatform);
  const q = useQuery({
    queryKey: ["platform-admin", user?.id ?? "anon"],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
  return {
    isPlatformAdmin: !!q.data?.isPlatformAdmin,
    totalAdmins: q.data?.totalAdmins ?? 0,
    loading: q.isLoading,
    refetch: q.refetch,
  };
}

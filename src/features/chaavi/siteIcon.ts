import { useQuery } from "@tanstack/react-query";
import { chaavi, isMeshOnline } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";
import type { ChaaviItem } from "../../types/chaavi";

/**
 * The domain of an item's site: the host of its first login website, lower-cased without `www.` or a port, or null when it is not a
 * login, has no website, or the website is not a domain name (an IP address, an app id, a bare word).
 */
export function siteDomain(item: Pick<ChaaviItem, "type"> & { login?: { uris: ReadonlyArray<{ uri: string }> } }): string | null {
  const first = item.type === "login" ? item.login?.uris[0]?.uri.trim() : undefined;
  if (first === undefined || first === "") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(first) ? first : `https://${first}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !/^\d+(\.\d+)+$/.test(host) ? host : null;
}

/** What {@link useSiteIcon} reports: the address of the site's icon once Chaavi has served one, and null while it loads or when there is none. */
export type SiteIcon = { src: string | null };

/**
 * The icon Chaavi's own proxy serves for a domain, held in the query cache for good so each domain is asked for once. While it loads,
 * and when there is no icon or no domain, `src` is null and the caller draws its letter mark.
 */
export function useSiteIcon(domain: string | null): SiteIcon {
  const { state } = useConnection();
  const query = useQuery({
    queryKey: ["chaavi", "icon", domain],
    queryFn: async () => {
      const blob = await chaavi.getSiteIcon(domain!);
      return blob === null ? null : URL.createObjectURL(blob);
    },
    enabled: domain !== null && isMeshOnline(state),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return { src: query.data ?? null };
}

/**
 * Root-domain helpers shared by server and client.
 * Uses NEXT_PUBLIC_* only so these are safe in client components.
 */

const DEFAULT_ROOT = "localhost:3000";

export function rootDomainRaw(
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  return root.toLowerCase();
}

/** Hostname without port — e.g. `porfilo.com` or `localhost`. */
export function rootDomainHost(
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  return rootDomainRaw(root).replace(/:\d+$/, "");
}

/** Public CNAME target shown in DNS instructions. */
export function customDomainCnameTarget(
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  return (
    process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET ??
    `customers.${rootDomainHost(root)}`
  );
}

/** App origin for links and metadata — includes port in dev. */
export function appOrigin(
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  const raw = rootDomainRaw(root);
  if (raw.startsWith("localhost") || raw.startsWith("127.")) {
    return `http://${raw}`;
  }
  return `https://${rootDomainHost(root)}`;
}

/** Fully-qualified free subdomain, e.g. `max.porfilo.com`. */
export function freeSubdomainFqdn(
  label: string,
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  return `${label}.${rootDomainHost(root)}`;
}

/** Suffix shown beside the label input — `.porfilo.com` or `.localhost:3000` in dev. */
export function freeSubdomainSuffix(
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  const host = rootDomainHost(root);
  const portMatch = /:(\d+)$/.exec(rootDomainRaw(root));
  const port = portMatch?.[0] ?? "";
  return `.${host}${port}`;
}

/** Absolute URL for a portfolio host (free subdomain or custom domain). */
export function publicHostnameUrl(
  hostname: string,
  root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT,
): string {
  if (root.startsWith("localhost") || root.startsWith("127.")) {
    return `http://${hostname}`;
  }
  return `https://${hostname}`;
}

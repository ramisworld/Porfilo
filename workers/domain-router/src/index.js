/**
 * Porfilo custom-domain router (Cloudflare Worker).
 *
 * Fallback origin for Cloudflare-for-SaaS custom hostnames. Proxies to the
 * Railway app and tags the original hostname in `x-porfilo-host`.
 */
export default {
  /**
   * @param {Request} request
   * @param {{ UPSTREAM: string }} env
   */
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const customHost = incoming.hostname;

    const upstreamBase = new URL(env.UPSTREAM);
    const target = new URL(request.url);
    target.protocol = upstreamBase.protocol;
    target.hostname = upstreamBase.hostname;
    target.port = upstreamBase.port;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-porfilo-host", customHost);
    // Legacy header for backwards compatibility during migration
    headers.set("x-porthub-host", customHost);
    headers.set("x-forwarded-host", customHost);

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    return fetch(target.toString(), init);
  },
};

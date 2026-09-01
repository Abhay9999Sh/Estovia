import { useState, useEffect, useCallback } from "react";

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || json.message || "Request failed.");
    err.status = res.status;
    throw err;
  }
  return json.data || json;
}

/**
 * Small fetch + loading assistant for admin client pages.
 * Returns { data, loading, error, reload, refetch, setUrl, url }.
 */
export function useAdminFetch(initialUrl = "") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialUrl));
  const [error, setError] = useState("");
  const [url, setUrl] = useState(initialUrl);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const sep = url.includes("?") ? "&" : "?";
    const target = tick ? `${url}${sep}_t=${tick}` : url;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchJson(target);
        if (!active) return;
        setData(payload);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Network error. Please try again.");
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload, refetch, setUrl, url };
}
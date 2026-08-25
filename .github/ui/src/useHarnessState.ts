import { useEffect, useRef, useState } from "react";
import type { HarnessState } from "./types";

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

interface HarnessFeed {
  state: HarnessState | null;
  connection: ConnectionStatus;
  error: string | null;
}

// Subscribes to the backend SSE stream and keeps the latest harness snapshot.
// Auto-reconnects if the connection drops.
export function useHarnessState(): HarnessFeed {
  const [state, setState] = useState<HarnessState | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let closed = false;

    function connect() {
      const es = new EventSource("/api/stream");
      sourceRef.current = es;

      es.addEventListener("state", (evt) => {
        try {
          setState(JSON.parse((evt as MessageEvent).data));
          setConnection("live");
          setError(null);
        } catch (err) {
          setError(`Failed to parse state: ${(err as Error).message}`);
        }
      });

      es.onopen = () => setConnection("live");

      es.onerror = () => {
        if (closed) return;
        setConnection("reconnecting");
        es.close();
        // Browser EventSource retries automatically, but we recreate to be safe.
        setTimeout(() => {
          if (!closed) connect();
        }, 2000);
      };
    }

    connect();
    return () => {
      closed = true;
      sourceRef.current?.close();
    };
  }, []);

  return { state, connection, error };
}

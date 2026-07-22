import { useEffect, useRef } from "react";
import { loadStoredSession } from "../auth/session";
import { WS_BASE_URL } from "../config/env";

// Real-time chat updates, matching the web app (ainew Chat.jsx): the backend
// broadcasts every WhatsApp message over STOMP at /topic/chat/{tenantId}.
// The web uses SockJS + @stomp/stompjs; here we speak the (very small) STOMP
// subset directly over React Native's built-in WebSocket against Spring's raw
// SockJS transport endpoint (/ws/websocket) — no extra dependencies needed.

export type ChatSocketPayload = Record<string, any>;

const NULL_BYTE = "\0";

function stompFrame(command: string, headers: Record<string, string>, body = ""): string {
  const head = Object.entries(headers)
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");
  return `${command}\n${head}\n\n${body}${NULL_BYTE}`;
}

// A websocket message can contain multiple STOMP frames; heart-beats are
// bare newlines. Returns the parsed frames, ignoring anything malformed.
function parseFrames(data: string): Array<{ command: string; headers: Record<string, string>; body: string }> {
  const frames: Array<{ command: string; headers: Record<string, string>; body: string }> = [];
  for (const chunk of data.split(NULL_BYTE)) {
    const raw = chunk.replace(/^\n+/, "");
    if (!raw) continue;
    const headerEnd = raw.indexOf("\n\n");
    if (headerEnd < 0) continue;
    const lines = raw.slice(0, headerEnd).split("\n");
    const command = lines[0];
    const headers: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const i = line.indexOf(":");
      if (i > 0) headers[line.slice(0, i)] = line.slice(i + 1);
    }
    frames.push({ command, headers, body: raw.slice(headerEnd + 2) });
  }
  return frames;
}

/**
 * Subscribes to this tenant's chat topic and calls onEvent with each message
 * payload the backend broadcasts (same payloads the web app receives).
 * Reconnects automatically every 5s while mounted. onEvent is kept in a ref,
 * so callers can pass a fresh closure on every render without re-connecting.
 */
export function useChatSocket(
  onEvent: (payload: ChatSocketPayload) => void,
  onStatus?: (status: string) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const wsUrl =
      WS_BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws/websocket";

    async function connect() {
      if (closed) return;
      const session = await loadStoredSession();
      const tenantId = session.tenantId;
      if (!tenantId) {
        scheduleReconnect();
        return;
      }

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (__DEV__) console.log("[chat] socket open, sending CONNECT");
        onStatusRef.current?.("open");
        // No heart-beats keeps the client tiny; the reconnect loop covers
        // silently-dead connections (next send/receive errors → onclose).
        ws?.send(
          stompFrame("CONNECT", {
            "accept-version": "1.2",
            "heart-beat": "0,0",
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          })
        );
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        for (const frame of parseFrames(event.data)) {
          if (frame.command === "CONNECTED") {
            if (__DEV__) console.log("[chat] socket CONNECTED, subscribing to /topic/chat/" + tenantId);
            onStatusRef.current?.("connected /topic/chat/" + tenantId);
            ws?.send(
              stompFrame("SUBSCRIBE", {
                id: `chat-${tenantId}`,
                destination: `/topic/chat/${tenantId}`,
              })
            );
          } else if (frame.command === "ERROR") {
            if (__DEV__) console.log("[chat] socket STOMP ERROR:", frame.headers.message || frame.body);
            onStatusRef.current?.("STOMP ERROR: " + String(frame.headers.message || frame.body).slice(0, 80));
          } else if (frame.command === "MESSAGE") {
            if (__DEV__) console.log("[chat] socket MESSAGE received");
            try {
              onEventRef.current(JSON.parse(frame.body));
            } catch {
              // Non-JSON broadcast — ignore.
            }
          }
        }
      };

      ws.onerror = () => {
        // onclose follows and handles the reconnect.
      };

      ws.onclose = (e) => {
        if (__DEV__) console.log("[chat] socket closed", (e as any)?.code, (e as any)?.reason);
        onStatusRef.current?.(`closed ${(e as any)?.code ?? ""} ${(e as any)?.reason ?? ""}`.trim());
        ws = null;
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (closed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 5000);
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // already closed
      }
      ws = null;
    };
  }, []);
}

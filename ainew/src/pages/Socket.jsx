import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_BASE_URL } from "../config/env";

export default function useSocket({
  token,
  tenantId,
  contacts,
  selectedContactIdRef,
  setMessages,
  setUnreadCounts,
  setLastActivity,
  pushToast,
  setError,
  setInfo,
}) {

  const stompRef = useRef(null);

  useEffect(() => {

    if (!token || !tenantId || contacts.length === 0) return;

    // destroy old client
    if (stompRef.current) {
      stompRef.current.deactivate();
      stompRef.current = null;
    }

    const client = new Client({

      webSocketFactory: () =>
        new SockJS(`${WS_BASE_URL}/ws`),

      reconnectDelay: 5000,

      debug: (str) => {
        console.log("STOMP:", str);
      },
    });

    client.onConnect = () => {

      console.log("WebSocket Connected");

      contacts.forEach((contact) => {

        client.subscribe(
          `/topic/chat/${tenantId}/${contact.id}`,
          (frame) => {

            const payload = JSON.parse(frame.body);

            const activeId = selectedContactIdRef.current;

            // update sidebar activity
            setLastActivity((prev) => ({
              ...prev,
              [contact.id]: {
                timestamp: new Date(
                  payload.createdAt || Date.now()
                ).getTime(),

                preview: payload.textBody || "",
              },
            }));

            const isInbound =
              payload.direction?.toUpperCase() ===
              "INBOUND";

            // unread badge
            if (
              isInbound &&
              contact.id !== activeId
            ) {

              setUnreadCounts((prev) => ({
                ...prev,
                [contact.id]:
                  (prev[contact.id] || 0) + 1,
              }));

              pushToast(
                contact.id,
                contact.name || contact.phone,
                (payload.textBody || "").slice(0, 60)
              );

              // browser notification
              if (
                Notification.permission ===
                "granted"
              ) {

                new Notification(
                  contact.name || "New Message",
                  {
                    body:
                      payload.textBody || "",
                  }
                );
              }
            }

            // active chat update
            if (contact.id === activeId) {

              setMessages((current) => {

                const exists = current.find(
                  (m) => m.id === payload.id
                );

                if (exists) return current;

                return [...current, payload].sort(
                  (a, b) =>
                    new Date(a.createdAt) -
                    new Date(b.createdAt)
                );
              });
            }
          }
        );
      });

      setInfo("Live updates connected");
    };

    client.onStompError = (frame) => {

      console.log(frame);

      setError(
        frame.headers.message ||
        "WebSocket Error"
      );
    };

    client.activate();

    stompRef.current = client;

    return () => {

      if (stompRef.current) {
        stompRef.current.deactivate();
      }
    };

  }, [
    token,
    tenantId,
    contacts.map((c) => c.id).join(","),
  ]);
}

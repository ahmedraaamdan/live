/**
 * Server-sent events per lecture: new questions and answers, status changes
 * (went live / ended), the viewer count and recording updates.
 *
 * In-memory, so it assumes one API process. Running several needs a shared
 * bus (Postgres LISTEN/NOTIFY or Redis) behind publish(); nothing else changes.
 */
import type { Response } from "express";
import type { LectureEvent, Role } from "@workspace/live-core";

interface Client {
  res: Response;
  userId: string;
  role: Role;
}

const rooms = new Map<string, Set<Client>>();

function write(res: Response, event: LectureEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function publish(lectureId: string, event: LectureEvent) {
  for (const c of rooms.get(lectureId) ?? []) write(c.res, event);
}

/** Distinct students currently connected. */
export function viewerCount(lectureId: string): number {
  const ids = new Set<string>();
  for (const c of rooms.get(lectureId) ?? []) if (c.role === "student") ids.add(c.userId);
  return ids.size;
}

export function subscribe(lectureId: string, client: Client) {
  const { res } = client;
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Caddy/nginx must not buffer the stream.
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  let set = rooms.get(lectureId);
  if (!set) rooms.set(lectureId, (set = new Set()));
  set.add(client);
  publish(lectureId, { type: "viewers", count: viewerCount(lectureId) });

  const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
  res.on("close", () => {
    clearInterval(ping);
    set!.delete(client);
    if (set!.size === 0) rooms.delete(lectureId);
    else publish(lectureId, { type: "viewers", count: viewerCount(lectureId) });
  });
}

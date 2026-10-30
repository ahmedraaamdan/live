/**
 * Live video through LiveKit (Cloud or self-hosted): the teacher publishes
 * camera/screen, booked students subscribe. Recording is a room-composite
 * egress written to the S3-compatible bucket in env.recordings.
 *
 * Questions, answers and attendance don't ride on LiveKit; they go through
 * the API (stored, and streamed over SSE), so they work and persist even if
 * the video provider changes.
 */
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver,
} from "livekit-server-sdk";
import type { Lecture, User } from "@workspace/db";
import { env, liveConfigured, recordingConfigured } from "./env";
import { logger } from "./logger";

const httpUrl = env.livekit.url.replace(/^ws/, "http");

export const roomName = (lectureId: string) => `lecture_${lectureId}`;
export const lectureIdFromRoom = (room: string) => (room.startsWith("lecture_") ? room.slice(8) : null);

const rooms = liveConfigured ? new RoomServiceClient(httpUrl, env.livekit.apiKey, env.livekit.apiSecret) : null;
const egress = liveConfigured ? new EgressClient(httpUrl, env.livekit.apiKey, env.livekit.apiSecret) : null;
export const webhookReceiver = liveConfigured ? new WebhookReceiver(env.livekit.apiKey, env.livekit.apiSecret) : null;

export async function liveToken(lecture: Lecture, user: User, host: boolean): Promise<string | null> {
  if (!liveConfigured) return null;
  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity: user.id,
    name: user.name,
    metadata: JSON.stringify({ role: host ? "host" : "viewer" }),
    ttl: "6h",
  });
  at.addGrant({
    room: roomName(lecture.id),
    roomJoin: true,
    canSubscribe: true,
    canPublish: host,
    canPublishData: host,
    roomAdmin: host,
  });
  return at.toJwt();
}

export async function openRoom(lecture: Lecture) {
  if (!rooms) return;
  try {
    await rooms.createRoom({ name: roomName(lecture.id), emptyTimeout: 15 * 60, departureTimeout: 120, maxParticipants: env.livekit.maxParticipants || undefined });
  } catch (err) {
    logger.warn({ err, lectureId: lecture.id }, "createRoom failed");
    throw err;
  }
}

export async function closeRoom(lecture: Lecture) {
  if (!rooms) return;
  try {
    await rooms.deleteRoom(roomName(lecture.id));
  } catch (err) {
    logger.warn({ err, lectureId: lecture.id }, "deleteRoom failed");
  }
}

/** Starts recording the room; returns the egress id, or null when recording is off. */
export async function startRecording(lecture: Lecture): Promise<string | null> {
  if (!egress || !recordingConfigured) return null;
  const r = env.recordings;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: `recordings/${lecture.id}/{time}.mp4`,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: r.accessKey,
        secret: r.secret,
        bucket: r.bucket,
        region: r.region,
        endpoint: r.endpoint,
        forcePathStyle: true,
      }),
    },
  });
  try {
    const info = await egress.startRoomCompositeEgress(roomName(lecture.id), { file: output }, { layout: "speaker" });
    return info.egressId;
  } catch (err) {
    logger.error({ err, lectureId: lecture.id }, "startRoomCompositeEgress failed");
    return null;
  }
}

export async function stopRecording(egressId: string) {
  if (!egress) return;
  try {
    await egress.stopEgress(egressId);
  } catch (err) {
    logger.warn({ err, egressId }, "stopEgress failed");
  }
}

/** Public URL of a finished recording, from the egress file result. */
export function recordingUrl(filename: string | undefined, location: string | undefined): string | null {
  if (env.recordings.publicBase && filename) return `${env.recordings.publicBase}/${filename.replace(/^\//, "")}`;
  return location || null;
}

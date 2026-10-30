/**
 * LiveKit in React, kept small: connect with the API's token, publish
 * (teacher) or subscribe (students), and expose the teacher's camera and
 * screen-share tracks. livekit-client is loaded only on the live screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalVideoTrack, RemoteVideoTrack, Room } from 'livekit-client';

type VideoTrack = LocalVideoTrack | RemoteVideoTrack;

export interface LiveState {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  error: string | null;
  camera: VideoTrack | null;
  screen: VideoTrack | null;
  screenIsBoard: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  /** Browsers block sound until a tap; show a button when true. */
  audioBlocked: boolean;
  /** Someone with publish rights (the teacher) is in the room. */
  hostPresent: boolean;
}

const initial: LiveState = { status: 'idle', error: null, camera: null, screen: null, screenIsBoard: false, micOn: false, camOn: false, screenOn: false, audioBlocked: false, hostPresent: false };

export function useLiveRoom(opts: { url: string | null; token: string | null; host: boolean }) {
  const [state, setState] = useState<LiveState>(initial);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!opts.url || !opts.token) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      const lk = await import('livekit-client');
      if (cancelled) return;
      room = new lk.Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: lk.VideoPresets.h360.resolution }, publishDefaults: { videoEncoding: { maxBitrate: 400_000, maxFramerate: 15 }, screenShareEncoding: { maxBitrate: 1_000_000, maxFramerate: 15 } } });
      roomRef.current = room;

      const refresh = () => {
        if (!room || cancelled) return;
        let camera: VideoTrack | null = null;
        let screen: VideoTrack | null = null;
        let screenIsBoard = false;
        let hostPresent = false;
        const participants = opts.host ? [room.localParticipant] : [...room.remoteParticipants.values()];
        for (const p of participants) {
          if (!opts.host && !p.permissions?.canPublish) continue;
          hostPresent = true;
          for (const pub of p.trackPublications.values()) {
            const t = pub.track;
            if (!t || t.kind !== lk.Track.Kind.Video || pub.isMuted || t.mediaStreamTrack.readyState === 'ended') continue;
            if (pub.source === lk.Track.Source.ScreenShare) { screen = t as VideoTrack; screenIsBoard = pub.trackName === 'whiteboard'; }
            else if (pub.source === lk.Track.Source.Camera) camera = t as VideoTrack;
          }
        }
        const lp = room.localParticipant;
        setState((s) => ({
          ...s,
          camera,
          screen,
          screenIsBoard,
          hostPresent: opts.host || hostPresent,
          micOn: lp.isMicrophoneEnabled,
          camOn: lp.isCameraEnabled,
          screenOn: lp.isScreenShareEnabled,
          audioBlocked: !room!.canPlaybackAudio,
        }));
      };

      const E = lk.RoomEvent;
      room
        // Remote sound plays through <audio> elements LiveKit creates; video is attached by TrackView.
        .on(E.TrackSubscribed, (track) => {
          if (track.kind === lk.Track.Kind.Audio) {
            const el = track.attach();
            el.hidden = true;
            document.body.appendChild(el);
          }
          refresh();
        })
        .on(E.TrackUnsubscribed, (track) => {
          if (track.kind === lk.Track.Kind.Audio) track.detach().forEach((el) => el.remove());
          // LiveKit emits unsubscribe before clearing publication.track.
          // Clear the old reference immediately, then inspect the final maps.
          setState(s => ({ ...s, camera: s.camera === track ? null : s.camera, screen: s.screen === track ? null : s.screen, screenIsBoard: s.screen === track ? false : s.screenIsBoard }));
          queueMicrotask(refresh);
        })
        .on(E.TrackUnpublished, () => queueMicrotask(refresh))
        .on(E.TrackPublished, refresh)
        .on(E.TrackSubscriptionStatusChanged, () => queueMicrotask(refresh))
        .on(E.TrackMuted, refresh)
        .on(E.TrackUnmuted, refresh)
        .on(E.LocalTrackPublished, refresh)
        .on(E.LocalTrackUnpublished, () => queueMicrotask(refresh))
        .on(E.ParticipantConnected, refresh)
        .on(E.ParticipantDisconnected, refresh)
        .on(E.AudioPlaybackStatusChanged, refresh)
        .on(E.Reconnecting, () => setState((s) => ({ ...s, status: 'reconnecting' })))
        .on(E.Reconnected, () => { setState((s) => ({ ...s, status: 'connected' })); refresh(); })
        .on(E.Disconnected, () => setState((s) => ({ ...s, status: 'disconnected' })));

      setState((s) => ({ ...s, status: 'connecting' }));
      try {
        await room.connect(opts.url!, opts.token!);
        if (cancelled) { await room.disconnect(); return; }
        if (opts.host) {
          await room.localParticipant.setMicrophoneEnabled(true);
          await room.localParticipant.setCameraEnabled(true);
        }
        setState((s) => ({ ...s, status: 'connected', error: null }));
        refresh();
      } catch (err) {
        setState((s) => ({ ...s, status: 'error', error: err instanceof Error ? err.message : String(err) }));
      }
    })();

    return () => {
      cancelled = true;
      void room?.disconnect();
      roomRef.current = null;
      setState(initial);
    };
  }, [opts.url, opts.token, opts.host]);

  const toggleMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (lp) await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
    setState((s) => ({ ...s, micOn: Boolean(lp?.isMicrophoneEnabled) }));
  }, []);
  const toggleCam = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (lp) await lp.setCameraEnabled(!lp.isCameraEnabled);
  }, []);
  const toggleScreen = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    try {
      if (lp) await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: true });
    } catch {
      // The user cancelled the screen picker.
    }
  }, []);
  const startAudio = useCallback(async () => {
    await roomRef.current?.startAudio();
    setState((s) => ({ ...s, audioBlocked: false }));
  }, []);
  /** Publishes the whiteboard canvas as a screen share, so it's in the recording. Resolves to an unpublish function. */
  const publishCanvas = useCallback(async (canvas: HTMLCanvasElement) => {
    const room = roomRef.current;
    if (!room) return () => undefined;
    const lk = await import('livekit-client');
    const track = canvas.captureStream(15).getVideoTracks()[0];
    if (!track) return () => undefined;
    let pub;
    try { pub = await room.localParticipant.publishTrack(track, { source: lk.Track.Source.ScreenShare, name: 'whiteboard' }); }
    catch (error) { track.stop(); throw error; }
    return () => {
      setState(s => ({ ...s, screen: s.screen === pub.track ? null : s.screen, screenIsBoard: s.screen === pub.track ? false : s.screenIsBoard }));
      if (pub.track) void room.localParticipant.unpublishTrack(pub.track).catch(() => undefined);
      track.stop();
    };
  }, []);
  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);

  return { ...state, toggleMic, toggleCam, toggleScreen, startAudio, disconnect, publishCanvas };
}

/**
 * Camera preview without LiveKit: the studio before going live, and the
 * whole studio in development where LiveKit isn't configured.
 */
export function useLocalPreview(enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let s: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: true })
      .then((m) => {
        if (cancelled) m.getTracks().forEach((t) => t.stop());
        else setStream((s = m));
      })
      .catch(() => setError('مقدرناش نفتح الكاميرا. اسمح للمتصفح يستخدم الكاميرا والمايك.'));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled]);
  return { stream, error };
}

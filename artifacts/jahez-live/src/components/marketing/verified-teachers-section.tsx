import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { BadgeCheck, Check } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

type VerifiedTeacher = { id: string; name: string; avatarUrl: string | null };
const appUrl = import.meta.env.VITE_LIVE_APP_URL || siteConfig.appUrl;

function resolveAvatarUrl(value: string | null) {
  if (!value?.trim()) return undefined;
  try {
    return new URL(value, appUrl).href;
  } catch {
    return undefined;
  }
}

function TeacherAvatar({ teacher }: { teacher: VerifiedTeacher }) {
  const url = resolveAvatarUrl(teacher.avatarUrl);
  const [failedUrl, setFailedUrl] = useState<string>();
  const initials = teacher.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("");
  return (
    <span className="verified-avatar">
      {url && url !== failedUrl ? (
        <img src={url} alt="" loading="lazy" width={48} height={48}
          onError={() => setFailedUrl(url)} />
      ) : <span aria-hidden="true">{initials}</span>}
      <span className="verified-seal">
        <span className="sr-only">مدرس معتمد</span>
        <Check size={11} aria-hidden="true" />
      </span>
    </span>
  );
}

export function VerifiedTeachersSection() {
  const { data: teachers } = useQuery({
    queryKey: ["verified-teachers"],
    queryFn: async ({ signal }): Promise<VerifiedTeacher[]> => {
      const response = await fetch(`${appUrl}/api/public/verified-teachers`, { signal });
      if (!response.ok) throw new Error("Could not load verified teachers");
      return response.json();
    },
    refetchInterval: 60_000,
  });
  const track = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const count = teachers?.length ?? 0;

  useEffect(() => {
    const list = track.current;
    if (!list || reduceMotion) return;
    const hover = window.matchMedia("(hover: hover)");
    let edge = 0;
    let direction = -1;
    let pointer: number | undefined;
    let resumeAt = 0;
    let previous = 0;
    let remainder = 0;
    let position = list.scrollLeft;
    let frame = 0;

    const measure = () => { edge = list.clientWidth - list.scrollWidth; };
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    measure();

    const start = (event: PointerEvent) => { pointer = event.pointerId; };
    const end = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      pointer = undefined;
      resumeAt = performance.now() + 700;
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = Math.min(now - previous, 34);
      previous = now;
      const current = list.scrollLeft;
      // Native touch momentum and trackpad scrolling can continue after release.
      if (current !== position) {
        position = current;
        resumeAt = now + 700;
      }
      if (edge >= 0 || pointer !== undefined || now < resumeAt ||
        list.matches(":focus-within") || (hover.matches && list.matches(":hover"))) {
        remainder = 0;
        return;
      }
      if (current <= edge + 1) direction = 1;
      if (current >= -1) direction = -1;
      remainder += elapsed * 0.026;
      const step = Math.floor(remainder);
      if (!step) return;
      remainder -= step;
      list.scrollLeft = Math.max(edge, Math.min(0, current + step * direction));
      position = list.scrollLeft;
    };
    list.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      list.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [count, reduceMotion]);

  if (!teachers?.length) return null;
  return (
    <section className="studio-section verified-teachers" aria-labelledby="verified-teachers-title">
      <div className="container-wide">
        <div className="studio-section-head">
          <div>
            <span className="studio-kicker"><BadgeCheck size={16} aria-hidden="true" /> معتمدون على جاهز Live</span>
            <h2 id="verified-teachers-title">مدرسينا <span>المعتمدين</span></h2>
            <p className="mt-2 text-muted-foreground">تعرّف على المدرسين اللي راجعنا واعتمدنا توثيقهم.</p>
          </div>
        </div>
        <ul ref={track} className="verified-track">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <a className="verified-card" href={`${appUrl}/teachers/${teacher.id}`}>
                <TeacherAvatar teacher={teacher} />
                <bdi>{teacher.name}</bdi>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

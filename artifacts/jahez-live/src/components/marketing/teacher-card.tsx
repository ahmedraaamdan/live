import { ShieldCheck, Star, Users, Video } from "lucide-react";
import type { TeacherItem } from "@/data/classes";
import { TeacherPhoto } from "./teacher-photo";

export function TeacherDirectoryCard({
  teacher,
  followed,
  onFollow,
}: {
  teacher: TeacherItem;
  followed: boolean;
  onFollow: () => void;
}) {
  return (
    <article
      className="teacher-directory-card hover-lift"
      data-testid={`card-teacher-${teacher.id}`}
    >
      <div className="teacher-directory-top">
        <TeacherPhoto
          id={teacher.id}
          name={teacher.name}
          className={`teacher-avatar ${teacher.avatar}`}
        />
        {teacher.verified && (
          <span className="verified">
            <ShieldCheck size={13} /> موثّق
          </span>
        )}
      </div>
      <h3>{teacher.name}</h3>
      <p className="teacher-directory-subject">{teacher.subject}</p>
      <div className="teacher-directory-stats">
        <span>
          <Star size={13} /> {teacher.rating} <em>({teacher.ratingCount})</em>
        </span>
        <span>
          <Users size={13} /> {teacher.followers}
        </span>
        <span>
          <Video size={13} /> {teacher.classCount} حصة
        </span>
      </div>
      <button
        className={`expert-follow ${followed ? "active" : ""}`}
        onClick={onFollow}
        data-testid={`button-follow-teacher-${teacher.id}`}
      >
        {followed ? "تتابعه الآن" : "متابعة المدرس"}
      </button>
    </article>
  );
}

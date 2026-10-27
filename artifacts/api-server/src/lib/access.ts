/** Who may see or do what with a lecture. */
import { and, eq, inArray } from "drizzle-orm";
import { bookingsTable, db, lecturesTable, parentLinksTable, type Lecture, type User } from "@workspace/db";
import { forbidden, notFound } from "./http";

export async function getLecture(id: string): Promise<Lecture> {
  const lecture = await db.query.lecturesTable.findFirst({ where: eq(lecturesTable.id, id) });
  if (!lecture) throw notFound("الحصة دي مش موجودة");
  return lecture;
}

export function assertOwner(user: User, lecture: Lecture) {
  if (user.role !== "admin" && lecture.teacherId !== user.id) throw forbidden();
}

export async function childIds(parentId: string): Promise<string[]> {
  const rows = await db.select({ id: parentLinksTable.studentId }).from(parentLinksTable).where(eq(parentLinksTable.parentId, parentId));
  return rows.map((r) => r.id);
}

export async function isParentOf(parentId: string, studentId: string): Promise<boolean> {
  const row = await db.query.parentLinksTable.findFirst({
    where: and(eq(parentLinksTable.parentId, parentId), eq(parentLinksTable.studentId, studentId)),
  });
  return Boolean(row);
}

export async function hasConfirmedBooking(studentIds: string[], lectureId: string): Promise<boolean> {
  if (studentIds.length === 0) return false;
  const row = await db.query.bookingsTable.findFirst({
    where: and(eq(bookingsTable.lectureId, lectureId), inArray(bookingsTable.studentId, studentIds), eq(bookingsTable.status, "confirmed")),
  });
  return Boolean(row);
}

/** Owner, admin, a booked student, or the parent of one. */
export async function canAccessLecture(user: User, lecture: Lecture): Promise<boolean> {
  if (user.role === "admin" || lecture.teacherId === user.id) return true;
  if (user.role === "student") return hasConfirmedBooking([user.id], lecture.id);
  if (user.role === "parent") return hasConfirmedBooking(await childIds(user.id), lecture.id);
  return false;
}

export async function assertAccess(user: User, lecture: Lecture) {
  if (!(await canAccessLecture(user, lecture))) throw forbidden("الحصة دي للي حاجزينها بس");
}

/** Students holding a confirmed seat. */
export async function bookedStudentIds(lectureId: string): Promise<string[]> {
  const rows = await db
    .select({ id: bookingsTable.studentId })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.lectureId, lectureId), eq(bookingsTable.status, "confirmed")));
  return rows.map((r) => r.id);
}

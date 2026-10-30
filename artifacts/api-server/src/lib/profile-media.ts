import { and, eq } from "drizzle-orm";
import { db, uploadsTable } from "@workspace/db";
import { env } from "./env";
import { badRequest, uuidParam } from "./http";

/** Linking an uploaded file never lets one account publish another account's file. */
export async function assertOwnedMediaUrl(ownerId: string, value: string | null | undefined, imageOnly = false) {
  if (!value) return;
  let url: URL;
  try { url = new URL(value); } catch { throw badRequest("أدخل رابطًا صحيحًا"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw badRequest("هذا النوع من الروابط غير مسموح");
  const apiOrigin = new URL(env.apiUrl).origin;
  if (url.origin !== apiOrigin && url.protocol !== "https:") throw badRequest("استخدم رابطًا آمنًا يبدأ بـ https://");
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); } catch { throw badRequest("رابط الملف غير صالح"); }
  const match = url.origin === apiOrigin && pathname.match(/^\/api\/uploads\/([0-9a-f-]{36})$/i);
  if (!match) {
    if (url.origin === apiOrigin && /\/api\/uploads\//i.test(pathname)) throw badRequest("رابط الملف غير صالح");
    return;
  }
  const upload = await db.query.uploadsTable.findFirst({ where: and(eq(uploadsTable.id, uuidParam(match[1])), eq(uploadsTable.ownerId, ownerId)) });
  if (!upload || (imageOnly && !upload.mime.startsWith("image/"))) throw badRequest(imageOnly ? "اختر صورة رفعتها من حسابك" : "اختر ملفًا رفعته من حسابك");
}

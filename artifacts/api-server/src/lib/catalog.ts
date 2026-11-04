import { eq } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";
import {
  CURRENCIES,
  CURRICULUMS,
  DEFAULT_GRADES,
  DEFAULT_SUBJECTS,
  catalogUpdateSchema,
  setCatalog,
  type CatalogDTO,
} from "@workspace/live-core";

const SETTINGS_KEY = "catalog";

export function defaultCatalog(): CatalogDTO {
  return {
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    grades: DEFAULT_GRADES.map((g) => ({ ...g })),
    curriculums: CURRICULUMS.map((c) => ({ ...c })),
    currencies: CURRENCIES.map((c) => ({ ...c })),
  };
}

export async function loadCatalog(): Promise<CatalogDTO> {
  const row = await db.query.platformSettingsTable.findFirst({
    where: eq(platformSettingsTable.key, SETTINGS_KEY),
  });
  if (!row) {
    const fallback = defaultCatalog();
    setCatalog(fallback);
    return fallback;
  }
  const parsed = catalogUpdateSchema.safeParse(row.value);
  const catalog: CatalogDTO = parsed.success
    ? {
        subjects: parsed.data.subjects,
        grades: parsed.data.grades,
        curriculums: parsed.data.curriculums ?? CURRICULUMS,
        currencies: parsed.data.currencies ?? CURRENCIES,
      }
    : defaultCatalog();
  setCatalog(catalog);
  return catalog;
}

export async function saveCatalog(input: CatalogDTO): Promise<CatalogDTO> {
  const now = new Date();
  await db
    .insert(platformSettingsTable)
    .values({ key: SETTINGS_KEY, value: input, updatedAt: now })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value: input, updatedAt: now },
    });
  setCatalog(input);
  return input;
}

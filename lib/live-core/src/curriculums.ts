/**
 * Multi-country, multi-curriculum and multi-currency catalog for Gahez Live.
 */

export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  currency: string;
  defaultCurriculum: string;
  phonePlaceholder: string;
  phonePattern: string;
}

export const COUNTRIES: CountryConfig[] = [
  {
    code: "EG",
    name: "مصر",
    flag: "🇪🇬",
    phoneCode: "+20",
    currency: "EGP",
    defaultCurriculum: "egypt_general",
    phonePlaceholder: "10 1234 5678",
    phonePattern: "^(10|11|12|15)[0-9]{8}$",
  },
  {
    code: "QA",
    name: "قطر",
    flag: "🇶🇦",
    phoneCode: "+974",
    currency: "QAR",
    defaultCurriculum: "qatar_general",
    phonePlaceholder: "5512 3456",
    phonePattern: "^[3567][0-9]{7}$",
  },
  {
    code: "SA",
    name: "المملكة العربية السعودية",
    flag: "🇸🇦",
    phoneCode: "+966",
    currency: "SAR",
    defaultCurriculum: "saudi_general",
    phonePlaceholder: "50 123 4567",
    phonePattern: "^5[0-9]{8}$",
  },
  {
    code: "AE",
    name: "الإمارات",
    flag: "🇦🇪",
    phoneCode: "+971",
    currency: "AED",
    defaultCurriculum: "uae_general",
    phonePlaceholder: "50 123 4567",
    phonePattern: "^5[0-9]{8}$",
  },
  {
    code: "KW",
    name: "الكويت",
    flag: "🇰🇼",
    phoneCode: "+965",
    currency: "KWD",
    defaultCurriculum: "kuwait_general",
    phonePlaceholder: "9123 4567",
    phonePattern: "^[569][0-9]{7}$",
  },
  {
    code: "OM",
    name: "سلطنة عُمان",
    flag: "🇴🇲",
    phoneCode: "+968",
    currency: "OMR",
    defaultCurriculum: "oman_general",
    phonePlaceholder: "9123 4567",
    phonePattern: "^[79][0-9]{7}$",
  },
  {
    code: "BH",
    name: "البحرين",
    flag: "🇧🇭",
    phoneCode: "+973",
    currency: "BHD",
    defaultCurriculum: "saudi_general",
    phonePlaceholder: "3612 3456",
    phonePattern: "^[36][0-9]{7}$",
  },
  {
    code: "JO",
    name: "الأردن",
    flag: "🇯🇴",
    phoneCode: "+962",
    currency: "JOD",
    defaultCurriculum: "jordan_general",
    phonePlaceholder: "7 9123 4567",
    phonePattern: "^7[789][0-9]{7}$",
  },
  {
    code: "OTHER",
    name: "دولة أخرى / دولي",
    flag: "🌐",
    phoneCode: "+1",
    currency: "USD",
    defaultCurriculum: "international",
    phonePlaceholder: "555 123 4567",
    phonePattern: "^[0-9]{6,14}$",
  },
];

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  minPaidPriceCents: number;
  minPayoutCents: number;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م", minPaidPriceCents: 50_00, minPayoutCents: 100_00 },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق", minPaidPriceCents: 20_00, minPayoutCents: 50_00 },
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س", minPaidPriceCents: 20_00, minPayoutCents: 50_00 },
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ", minPaidPriceCents: 20_00, minPayoutCents: 50_00 },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك", minPaidPriceCents: 2_00, minPayoutCents: 5_00 },
  { code: "OMR", name: "ريال عُماني", symbol: "ر.ع", minPaidPriceCents: 2_00, minPayoutCents: 5_00 },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب", minPaidPriceCents: 2_00, minPayoutCents: 5_00 },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ", minPaidPriceCents: 5_00, minPayoutCents: 10_00 },
  { code: "USD", name: "دولار أمريكي", symbol: "$", minPaidPriceCents: 5_00, minPayoutCents: 15_00 },
];

export interface GradeItem {
  key: string;
  label: string;
  tracks?: string[];
}

export interface StageConfig {
  id: string;
  name: string;
  grades: GradeItem[];
}

export interface SubjectItem {
  key: string;
  label: string;
  stages?: string[];
  tracks?: string[];
}

export interface CurriculumConfig {
  id: string;
  name: string;
  country: string; // "EG", "QA", "SA", "AE", "KW", "OM", "JO", "ALL"
  description: string;
  stages: StageConfig[];
  tracks?: Array<{ key: string; label: string }>;
  subjects: SubjectItem[];
}

export const CURRICULUMS: CurriculumConfig[] = [
  // 1. مصر - التعليم العام
  {
    id: "egypt_general",
    name: "المنهج المصري (العام واللغات)",
    country: "EG",
    description: "المناهج الرسمية لوزارة التربية والتعليم المصرية لجميع المراحل",
    stages: [
      {
        id: "primary",
        name: "المرحلة الابتدائية",
        grades: [
          { key: "p4", label: "رابعة ابتدائي" },
          { key: "p5", label: "خامسة ابتدائي" },
          { key: "p6", label: "سادسة ابتدائي" },
        ],
      },
      {
        id: "middle",
        name: "المرحلة الإعدادية",
        grades: [
          { key: "m1", label: "أولى إعدادي" },
          { key: "m2", label: "تانية إعدادي" },
          { key: "m3", label: "تالتة إعدادي" },
        ],
      },
      {
        id: "secondary",
        name: "المرحلة الثانوية",
        grades: [
          { key: "s1", label: "أولى ثانوي", tracks: ["general"] },
          { key: "s2", label: "تانية ثانوي", tracks: ["science", "arts"] },
          { key: "s3", label: "تالتة ثانوي (ثانوية عامة)", tracks: ["science_biology", "science_math", "arts"] },
        ],
      },
    ],
    tracks: [
      { key: "general", label: "عام مشترك" },
      { key: "science", label: "علمي" },
      { key: "science_biology", label: "علمي علوم" },
      { key: "science_math", label: "علمي رياضة" },
      { key: "arts", label: "أدبي" },
    ],
    subjects: [
      { key: "arabic", label: "لغة عربية" },
      { key: "english", label: "لغة إنجليزية" },
      { key: "french", label: "لغة فرنسية" },
      { key: "german", label: "لغة ألمانية" },
      { key: "math", label: "رياضيات" },
      { key: "science", label: "علوم", stages: ["primary", "middle"] },
      { key: "social_studies", label: "دراسات اجتماعية", stages: ["primary", "middle"] },
      { key: "physics", label: "فيزياء", stages: ["secondary"], tracks: ["science", "science_biology", "science_math", "general"] },
      { key: "chemistry", label: "كيمياء", stages: ["secondary"], tracks: ["science", "science_biology", "science_math", "general"] },
      { key: "biology", label: "أحياء", stages: ["secondary"], tracks: ["science", "science_biology", "general"] },
      { key: "geology", label: "جيولوجيا وعلوم بيئية", stages: ["secondary"], tracks: ["science_biology"] },
      { key: "pure_math", label: "تفاضل وتكامل وجبر", stages: ["secondary"], tracks: ["science_math", "science"] },
      { key: "applied_math", label: "ميكانيكا (استاتيكا وديناميكا)", stages: ["secondary"], tracks: ["science_math"] },
      { key: "history", label: "تاريخ", stages: ["secondary"], tracks: ["arts", "general"] },
      { key: "geography", label: "جغرافيا", stages: ["secondary"], tracks: ["arts", "general"] },
      { key: "philosophy", label: "فلسفة ومنطق", stages: ["secondary"], tracks: ["arts", "general"] },
      { key: "psychology", label: "علم نفس واجتماع", stages: ["secondary"], tracks: ["arts"] },
      { key: "religion", label: "تربية دينية إسلامية ومسيحية" },
      { key: "computer", label: "حاسب آلي وتكنولوجيا معلومات" },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 2. مصر - الأزهر الشريف
  {
    id: "egypt_azhar",
    name: "المنهج الأزهري الشريف",
    country: "EG",
    description: "العلوم الشرعية والعربية والمناهج الثقافية لقطاع المعاهد الأزهرية",
    stages: [
      {
        id: "azhar_primary",
        name: "الابتدائي الأزهري",
        grades: [
          { key: "az_p4", label: "رابعة ابتدائي أزهري" },
          { key: "az_p5", label: "خامسة ابتدائي أزهري" },
          { key: "az_p6", label: "سادسة ابتدائي أزهري" },
        ],
      },
      {
        id: "azhar_middle",
        name: "الإعدادي الأزهري",
        grades: [
          { key: "az_m1", label: "أولى إعدادي أزهري" },
          { key: "az_m2", label: "تانية إعدادي أزهري" },
          { key: "az_m3", label: "تالتة إعدادي أزهري (شهادة إعدادية)" },
        ],
      },
      {
        id: "azhar_secondary",
        name: "الثانوي الأزهري",
        grades: [
          { key: "az_s1", label: "أولى ثانوي أزهري", tracks: ["azhar_general"] },
          { key: "az_s2", label: "تانية ثانوي أزهري", tracks: ["azhar_science", "azhar_arts"] },
          { key: "az_s3", label: "تالتة ثانوي أزهري (ثانوية أزهرية)", tracks: ["azhar_science", "azhar_arts"] },
        ],
      },
    ],
    tracks: [
      { key: "azhar_general", label: "عام مشترك" },
      { key: "azhar_science", label: "علمي أزهري" },
      { key: "azhar_arts", label: "أدبي أزهري" },
    ],
    subjects: [
      { key: "az_fiqh_shafii", label: "فقه شافعي" },
      { key: "az_fiqh_hanafi", label: "فقه حنفي" },
      { key: "az_fiqh_maliki", label: "فقه مالكي" },
      { key: "az_fiqh_hanbali", label: "فقه حنبلي" },
      { key: "az_tafsir", label: "تفسير وعلوم قرآن" },
      { key: "az_hadith", label: "حديث ومصطلح" },
      { key: "az_tawhid", label: "توحيد وعقيدة" },
      { key: "az_sirah", label: "سيرة نبوية وتاريخ إسلامي" },
      { key: "az_quran", label: "قرآن كريم وتجويد" },
      { key: "az_nahw", label: "نحو وصرف" },
      { key: "az_balagha", label: "بلاغة ونقد" },
      { key: "az_adab", label: "أدب ونصوص ومطالعة" },
      { key: "az_mantiq", label: "منطق قديم وفلسفة أزهرية", stages: ["azhar_secondary"], tracks: ["azhar_arts"] },
      { key: "math", label: "رياضيات" },
      { key: "english", label: "لغة إنجليزية" },
      { key: "physics", label: "فيزياء", stages: ["azhar_secondary"], tracks: ["azhar_science"] },
      { key: "chemistry", label: "كيمياء", stages: ["azhar_secondary"], tracks: ["azhar_science"] },
      { key: "biology", label: "أحياء", stages: ["azhar_secondary"], tracks: ["azhar_science"] },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 3. تحفيظ القرآن الكريم والقراءات والعلوم الشرعية (عام لكل الدول)
  {
    id: "quran_studies",
    name: "تحفيظ القرآن الكريم والقراءات",
    country: "ALL",
    description: "حلقات تحفيظ، أحكام تجويد، إجازات بالسند المتصل وتصحيح تلاوة لجميع الأعمار",
    stages: [
      {
        id: "quran_kids_stage",
        name: "التأسيس والتلقين (الأطفال والمبتدئين)",
        grades: [
          { key: "q_kids_nour", label: "القاعدة النورانية ونور البيان" },
          { key: "q_kids_juz_amma", label: "حفظ وتلقين جزء عمّ" },
          { key: "q_kids_juz_tabarak", label: "حفظ وتلقين جزء تبارك" },
        ],
      },
      {
        id: "quran_hifz_stage",
        name: "مسارات الحفظ والمتابعة",
        grades: [
          { key: "q_hifz_quarter", label: "حفظ ربع القرآن (أول 7 أجزاء ونصف)" },
          { key: "q_hifz_half", label: "حفظ نصف القرآن (15 جزءاً)" },
          { key: "q_hifz_full", label: "حفظ القرآن الكريم كاملاً" },
          { key: "q_hifz_revision", label: "تثبيت ومراجعة الخاتمين" },
        ],
      },
      {
        id: "quran_tajweed_stage",
        name: "التجويد والإتقان النظري والعملي",
        grades: [
          { key: "q_tajweed_basics", label: "أحكام التجويد للمبتدئين وتصحيح التلاوة" },
          { key: "q_tajweed_tuhfa", label: "شرح وتحفيظ تحفة الأطفال" },
          { key: "q_tajweed_jazariya", label: "شرح وتحفيظ المقدمة الجزرية" },
        ],
      },
      {
        id: "quran_ijaza_stage",
        name: "الإجازات والقراءات بالسند",
        grades: [
          { key: "q_ijaza_hafs", label: "إجازة برواية حفص عن عاصم بالسند المتصل" },
          { key: "q_ijaza_warsh", label: "إجازة برواية ورش عن نافع" },
          { key: "q_ijaza_qaloon", label: "إجازة برواية قالون عن نافع" },
          { key: "q_ijaza_ten", label: "القراءات العشر (صغرى وكبرى)" },
        ],
      },
      {
        id: "islamic_studies_stage",
        name: "العلوم الشرعية المبسطة",
        grades: [
          { key: "isl_aqeedah", label: "العقيدة وأصول الإيمان" },
          { key: "isl_fiqh", label: "فقه العبادات والمعاملات" },
          { key: "isl_seerah", label: "السيرة النبوية وقصص الأنبياء" },
          { key: "isl_hadith", label: "الأربعون النووية وشرح الحديث" },
        ],
      },
    ],
    subjects: [
      { key: "quran_hifz", label: "حفظ ومتابعة القرآن الكريم" },
      { key: "quran_recitation", label: "تصحيح تلاوة وتلقين" },
      { key: "quran_tajweed", label: "أحكام التجويد ومخارج الحروف" },
      { key: "quran_ijaza", label: "إجازة وقراءات بالسند المتصل" },
      { key: "quran_nour", label: "القاعدة النورانية ونور البيان" },
      { key: "quran_mutoon", label: "متون التجويد (التحفة والجزرية)" },
      { key: "islamic_studies", label: "علوم شرعية وتربية إسلامية" },
    ],
  },

  // 4. دولة قطر
  {
    id: "qatar_general",
    name: "المنهج القطري الحكومي",
    country: "QA",
    description: "معايير وزارة التربية والتعليم والتعليم العالي بدولة قطر لجميع المراحل",
    stages: [
      {
        id: "qa_primary",
        name: "المرحلة الابتدائية",
        grades: [
          { key: "qa_p1", label: "الصف الأول الابتدائي" },
          { key: "qa_p2", label: "الصف الثاني الابتدائي" },
          { key: "qa_p3", label: "الصف الثالث الابتدائي" },
          { key: "qa_p4", label: "الصف الرابع الابتدائي" },
          { key: "qa_p5", label: "الصف الخامس الابتدائي" },
          { key: "qa_p6", label: "الصف السادس الابتدائي" },
        ],
      },
      {
        id: "qa_preparatory",
        name: "المرحلة الإعدادية",
        grades: [
          { key: "qa_m7", label: "الصف السابع الإعدادي" },
          { key: "qa_m8", label: "الصف الثامن الإعدادي" },
          { key: "qa_m9", label: "الصف التاسع الإعدادي" },
        ],
      },
      {
        id: "qa_secondary",
        name: "المرحلة الثانوية",
        grades: [
          { key: "qa_s10", label: "الصف العاشر (مشترك)", tracks: ["qa_common"] },
          { key: "qa_s11", label: "الصف الحادي عشر", tracks: ["qa_scientific", "qa_tech", "qa_humanities"] },
          { key: "qa_s12", label: "الصف الثاني عشر (الشهادة الثانوية العامة)", tracks: ["qa_scientific", "qa_tech", "qa_humanities"] },
        ],
      },
    ],
    tracks: [
      { key: "qa_common", label: "مشترك" },
      { key: "qa_scientific", label: "المسار العلمي" },
      { key: "qa_tech", label: "المسار التكنولوجي" },
      { key: "qa_humanities", label: "مسار الآداب والإنسانيات" },
    ],
    subjects: [
      { key: "islamic", label: "التربية الإسلامية" },
      { key: "arabic", label: "اللغة العربية" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "math", label: "الرياضيات" },
      { key: "science", label: "العلوم العامة", stages: ["qa_primary", "qa_preparatory", "qa_secondary"], tracks: ["qa_common", "qa_humanities"] },
      { key: "physics", label: "الفيزياء", stages: ["qa_secondary"], tracks: ["qa_scientific", "qa_tech"] },
      { key: "chemistry", label: "الكيمياء", stages: ["qa_secondary"], tracks: ["qa_scientific"] },
      { key: "biology", label: "الأحياء", stages: ["qa_secondary"], tracks: ["qa_scientific"] },
      { key: "ict", label: "الحوسبة وتكنولوجيا المعلومات" },
      { key: "social_studies", label: "العلوم الاجتماعية (تاريخ وجغرافيا قطر والعالم)" },
      { key: "business", label: "إدارة الأعمال والمهارات الحياتية", stages: ["qa_secondary"] },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 5. المملكة العربية السعودية
  {
    id: "saudi_general",
    name: "المنهج السعودي (نظام المسارات)",
    country: "SA",
    description: "مناهج وزارة التعليم السعودية ونظام المسارات الحديث للمرحلة الثانوية",
    stages: [
      {
        id: "sa_primary",
        name: "المرحلة الابتدائية",
        grades: [
          { key: "sa_p1", label: "الصف الأول الابتدائي" },
          { key: "sa_p2", label: "الصف الثاني الابتدائي" },
          { key: "sa_p3", label: "الصف الثالث الابتدائي" },
          { key: "sa_p4", label: "الصف الرابع الابتدائي" },
          { key: "sa_p5", label: "الصف الخامس الابتدائي" },
          { key: "sa_p6", label: "الصف السادس الابتدائي" },
        ],
      },
      {
        id: "sa_intermediate",
        name: "المرحلة المتوسطة",
        grades: [
          { key: "sa_m1", label: "أول متوسط" },
          { key: "sa_m2", label: "ثاني متوسط" },
          { key: "sa_m3", label: "ثالث متوسط" },
        ],
      },
      {
        id: "sa_secondary",
        name: "المرحلة الثانوية (المسارات)",
        grades: [
          { key: "sa_s1", label: "السنة الأولى المشتركة", tracks: ["sa_track_general"] },
          { key: "sa_s2", label: "السنة الثانية ثانوي", tracks: ["sa_track_general", "sa_track_cs", "sa_track_health", "sa_track_business", "sa_track_sharia"] },
          { key: "sa_s3", label: "السنة الثالثة ثانوي", tracks: ["sa_track_general", "sa_track_cs", "sa_track_health", "sa_track_business", "sa_track_sharia"] },
        ],
      },
    ],
    tracks: [
      { key: "sa_track_general", label: "المسار العام" },
      { key: "sa_track_cs", label: "مسار علوم الحاسب والهندسة" },
      { key: "sa_track_health", label: "مسار الصحة والحياة" },
      { key: "sa_track_business", label: "مسار إدارة الأعمال" },
      { key: "sa_track_sharia", label: "المسار الشرعي" },
    ],
    subjects: [
      { key: "sa_islamic", label: "الدراسات الإسلامية (توحيد، فقه، تفسير، حديث)" },
      { key: "sa_quran", label: "القرآن الكريم والتلاوة" },
      { key: "sa_arabic", label: "لغتي الجميلة / الكفايات اللغوية" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "math", label: "الرياضيات" },
      { key: "science", label: "العلوم", stages: ["sa_primary", "sa_intermediate"] },
      { key: "sa_digital", label: "التقنية الرقمية والبرمجة" },
      { key: "physics", label: "الفيزياء", stages: ["sa_secondary"], tracks: ["sa_track_general", "sa_track_cs", "sa_track_health"] },
      { key: "chemistry", label: "الكيمياء", stages: ["sa_secondary"], tracks: ["sa_track_general", "sa_track_health"] },
      { key: "biology", label: "الأحياء وعلم البيئة", stages: ["sa_secondary"], tracks: ["sa_track_general", "sa_track_health"] },
      { key: "sa_ai", label: "الذكاء الاصطناعي وعلم البيانات", stages: ["sa_secondary"], tracks: ["sa_track_cs"] },
      { key: "social_studies", label: "الدراسات الاجتماعية والمواطنة" },
      { key: "business", label: "مبادئ الإدارة والمالية", stages: ["sa_secondary"], tracks: ["sa_track_business"] },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 6. دولة الإمارات العربية المتحدة
  {
    id: "uae_general",
    name: "المنهج الإماراتي الوزاري",
    country: "AE",
    description: "مناهج وزارة التربية والتعليم الإماراتية ومسارات المرحلة الثانوية",
    stages: [
      {
        id: "ae_cycle1",
        name: "الحلقة الأولى (1 - 4)",
        grades: [
          { key: "ae_g1", label: "الصف الأول" },
          { key: "ae_g2", label: "الصف الثاني" },
          { key: "ae_g3", label: "الصف الثالث" },
          { key: "ae_g4", label: "الصف الرابع" },
        ],
      },
      {
        id: "ae_cycle2",
        name: "الحلقة الثانية (5 - 8)",
        grades: [
          { key: "ae_g5", label: "الصف الخامس" },
          { key: "ae_g6", label: "الصف السادس" },
          { key: "ae_g7", label: "الصف السابع" },
          { key: "ae_g8", label: "الصف الثامن" },
        ],
      },
      {
        id: "ae_cycle3",
        name: "الحلقة الثالثة / الثانوي (9 - 12)",
        grades: [
          { key: "ae_g9", label: "الصف التاسع", tracks: ["ae_general", "ae_advanced"] },
          { key: "ae_g10", label: "الصف العاشر", tracks: ["ae_general", "ae_advanced", "ae_elite"] },
          { key: "ae_g11", label: "الصف الحادي عشر", tracks: ["ae_general", "ae_advanced", "ae_elite", "ae_applied"] },
          { key: "ae_g12", label: "الصف الثاني عشر", tracks: ["ae_general", "ae_advanced", "ae_elite", "ae_applied"] },
        ],
      },
    ],
    tracks: [
      { key: "ae_general", label: "المسار العام" },
      { key: "ae_advanced", label: "المسار المتقدم" },
      { key: "ae_elite", label: "مسار النخبة" },
      { key: "ae_applied", label: "المسار التطبيقي" },
    ],
    subjects: [
      { key: "islamic", label: "التربية الإسلامية" },
      { key: "arabic", label: "اللغة العربية" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "math", label: "الرياضيات" },
      { key: "science", label: "العلوم العامة", stages: ["ae_cycle1", "ae_cycle2"] },
      { key: "physics", label: "الفيزياء", stages: ["ae_cycle3"] },
      { key: "chemistry", label: "الكيمياء", stages: ["ae_cycle3"] },
      { key: "biology", label: "الأحياء", stages: ["ae_cycle3"] },
      { key: "cs", label: "علوم الكمبيوتر والتصميم الإبداعي" },
      { key: "moral_social", label: "الدراسات الاجتماعية والتربية الأخلاقية" },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 7. دولة الكويت
  {
    id: "kuwait_general",
    name: "المنهج الكويتي",
    country: "KW",
    description: "مناهج وزارة التربية بدولة الكويت للمراحل الابتدائية والمتوسطة والثانوية",
    stages: [
      {
        id: "kw_primary",
        name: "المرحلة الابتدائية",
        grades: [
          { key: "kw_p1", label: "الصف الأول الابتدائي" },
          { key: "kw_p2", label: "الصف الثاني الابتدائي" },
          { key: "kw_p3", label: "الصف الثالث الابتدائي" },
          { key: "kw_p4", label: "الصف الرابع الابتدائي" },
          { key: "kw_p5", label: "الصف الخامس الابتدائي" },
        ],
      },
      {
        id: "kw_middle",
        name: "المرحلة المتوسطة",
        grades: [
          { key: "kw_m6", label: "الصف السادس المتوسط" },
          { key: "kw_m7", label: "الصف السابع المتوسط" },
          { key: "kw_m8", label: "الصف الثامن المتوسط" },
          { key: "kw_m9", label: "الصف التاسع المتوسط" },
        ],
      },
      {
        id: "kw_secondary",
        name: "المرحلة الثانوية",
        grades: [
          { key: "kw_s10", label: "الصف العاشر (مشترك)", tracks: ["kw_common"] },
          { key: "kw_s11", label: "الصف الحادي عشر", tracks: ["kw_sci", "kw_lit"] },
          { key: "kw_s12", label: "الصف الثاني عشر (الثانوية العامة)", tracks: ["kw_sci", "kw_lit"] },
        ],
      },
    ],
    tracks: [
      { key: "kw_common", label: "مشترك" },
      { key: "kw_sci", label: "القسم العلمي" },
      { key: "kw_lit", label: "القسم الأدبي" },
    ],
    subjects: [
      { key: "islamic", label: "التربية الإسلامية والقرآن الكريم" },
      { key: "arabic", label: "اللغة العربية" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "math", label: "الرياضيات" },
      { key: "science", label: "العلوم", stages: ["kw_primary", "kw_middle"] },
      { key: "physics", label: "الفيزياء", stages: ["kw_secondary"], tracks: ["kw_sci"] },
      { key: "chemistry", label: "الكيمياء", stages: ["kw_secondary"], tracks: ["kw_sci"] },
      { key: "biology", label: "الأحياء", stages: ["kw_secondary"], tracks: ["kw_sci"] },
      { key: "geology", label: "الجيولوجيا", stages: ["kw_secondary"], tracks: ["kw_sci"] },
      { key: "social_studies", label: "الاجتماعيات والتربية الوطنية" },
      { key: "history", label: "تاريخ العالم والوطن العربي", stages: ["kw_secondary"], tracks: ["kw_lit"] },
      { key: "geography", label: "الجغرافيا", stages: ["kw_secondary"], tracks: ["kw_lit"] },
      { key: "philosophy", label: "الفلسفة والمنطق", stages: ["kw_secondary"], tracks: ["kw_lit"] },
      { key: "computer", label: "الحاسوب" },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 8. سلطنة عُمان
  {
    id: "oman_general",
    name: "المنهج العُماني",
    country: "OM",
    description: "مناهج التعليم الأساسي ودبلوم التعليم العام في سلطنة عُمان",
    stages: [
      {
        id: "om_cycle1",
        name: "التعليم الأساسي (الحلقة الأولى 1 - 4)",
        grades: [
          { key: "om_g1", label: "الصف الأول" },
          { key: "om_g2", label: "الصف الثاني" },
          { key: "om_g3", label: "الصف الثالث" },
          { key: "om_g4", label: "الصف الرابع" },
        ],
      },
      {
        id: "om_cycle2",
        name: "التعليم الأساسي (الحلقة الثانية 5 - 10)",
        grades: [
          { key: "om_g5", label: "الصف الخامس" },
          { key: "om_g6", label: "الصف السادس" },
          { key: "om_g7", label: "الصف السابع" },
          { key: "om_g8", label: "الصف الثامن" },
          { key: "om_g9", label: "الصف التاسع" },
          { key: "om_g10", label: "الصف العاشر" },
        ],
      },
      {
        id: "om_diploma",
        name: "دبلوم التعليم العام (11 و 12)",
        grades: [
          { key: "om_g11", label: "الصف الحادي عشر", tracks: ["om_pure", "om_applied"] },
          { key: "om_g12", label: "الصف الثاني عشر (دبلوم التعليم العام)", tracks: ["om_pure", "om_applied"] },
        ],
      },
    ],
    tracks: [
      { key: "om_pure", label: "مسار العلوم والرياضيات البحتة" },
      { key: "om_applied", label: "مسار الأدبيات والرياضيات التطبيقية" },
    ],
    subjects: [
      { key: "islamic", label: "التربية الإسلامية" },
      { key: "arabic", label: "اللغة العربية" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "pure_math", label: "الرياضيات البحتة", stages: ["om_diploma"], tracks: ["om_pure"] },
      { key: "applied_math", label: "الرياضيات التطبيقية", stages: ["om_diploma"], tracks: ["om_applied"] },
      { key: "math", label: "الرياضيات العامة", stages: ["om_cycle1", "om_cycle2"] },
      { key: "science", label: "العلوم", stages: ["om_cycle1", "om_cycle2"] },
      { key: "physics", label: "الفيزياء", stages: ["om_diploma"], tracks: ["om_pure"] },
      { key: "chemistry", label: "الكيمياء", stages: ["om_diploma"], tracks: ["om_pure"] },
      { key: "biology", label: "الأحياء", stages: ["om_diploma"], tracks: ["om_pure"] },
      { key: "social_studies", label: "الدراسات الاجتماعية (هذا وطني)" },
      { key: "ict", label: "تقنية المعلومات" },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 9. المملكة الأردنية الهاشمية
  {
    id: "jordan_general",
    name: "المنهج الأردني (التوجيهي)",
    country: "JO",
    description: "مناهج وزارة التربية والتعليم الأردنية وشهادة الدراسة الثانوية العامة (التوجيهي)",
    stages: [
      {
        id: "jo_basic",
        name: "مرحلة التعليم الأساسي",
        grades: [
          { key: "jo_g4", label: "الصف الرابع الأساسي" },
          { key: "jo_g5", label: "الصف الخامس الأساسي" },
          { key: "jo_g6", label: "الصف السادس الأساسي" },
          { key: "jo_g7", label: "الصف السابع الأساسي" },
          { key: "jo_g8", label: "الصف الثامن الأساسي" },
          { key: "jo_g9", label: "الصف التاسع الأساسي" },
          { key: "jo_g10", label: "الصف العاشر الأساسي" },
        ],
      },
      {
        id: "jo_secondary",
        name: "المرحلة الثانوية (التوجيهي)",
        grades: [
          { key: "jo_s1", label: "أول ثانوي", tracks: ["jo_sci", "jo_lit", "jo_btec"] },
          { key: "jo_s2", label: "توجيهي (الثانوية العامة)", tracks: ["jo_sci", "jo_lit", "jo_btec"] },
        ],
      },
    ],
    tracks: [
      { key: "jo_sci", label: "الفرع العلمي" },
      { key: "jo_lit", label: "الفرع الأدبي" },
      { key: "jo_btec", label: "التعليم المهني BTEC" },
    ],
    subjects: [
      { key: "islamic", label: "التربية الإسلامية" },
      { key: "arabic", label: "اللغة العربية (مشترك وتخصص)" },
      { key: "english", label: "اللغة الإنجليزية" },
      { key: "math", label: "الرياضيات (علمي / أدبي)" },
      { key: "science", label: "العلوم العامة", stages: ["jo_basic"] },
      { key: "physics", label: "الفيزياء", stages: ["jo_secondary"], tracks: ["jo_sci"] },
      { key: "chemistry", label: "الكيمياء", stages: ["jo_secondary"], tracks: ["jo_sci"] },
      { key: "biology", label: "العلوم الحياتية", stages: ["jo_secondary"], tracks: ["jo_sci"] },
      { key: "geology", label: "علوم الأرض والبيئة", stages: ["jo_secondary"], tracks: ["jo_sci"] },
      { key: "history", label: "تاريخ الأردن وتاريخ العرب", stages: ["jo_secondary"] },
      { key: "geography", label: "الجغرافيا", stages: ["jo_secondary"], tracks: ["jo_lit"] },
      { key: "computer", label: "الحاسوب وتكنولوجيا المعلومات" },
      { key: "other", label: "مادة أخرى" },
    ],
  },

  // 10. المناهج الدولية (International)
  {
    id: "international",
    name: "المناهج الدولية (IGCSE / American / IB)",
    country: "ALL",
    description: "البريطاني، الأمريكي والدبلومة الدولية لجميع المواد والصفوف",
    stages: [
      {
        id: "intl_igcse",
        name: "المنهج البريطاني (IGCSE / Cambridge / Edexcel)",
        grades: [
          { key: "intl_y9", label: "Year 9 (Checkpoint)" },
          { key: "intl_y10", label: "Year 10 (IGCSE / OL)" },
          { key: "intl_y11", label: "Year 11 (IGCSE / OL)" },
          { key: "intl_y12", label: "Year 12 (AS Level)" },
          { key: "intl_y13", label: "Year 13 (A2 / A-Level)" },
        ],
      },
      {
        id: "intl_american",
        name: "الدبلومة الأمريكية (American Diploma / SAT / ACT)",
        grades: [
          { key: "intl_g9", label: "Grade 9" },
          { key: "intl_g10", label: "Grade 10" },
          { key: "intl_g11", label: "Grade 11 (SAT / ACT)" },
          { key: "intl_g12", label: "Grade 12 (AP / Graduation)" },
        ],
      },
      {
        id: "intl_ib",
        name: "البكالوريا الدولية (IB Diploma)",
        grades: [
          { key: "intl_ib_myp", label: "IB MYP" },
          { key: "intl_ib_dp1", label: "IB DP 1" },
          { key: "intl_ib_dp2", label: "IB DP 2" },
        ],
      },
    ],
    subjects: [
      { key: "intl_math", label: "Mathematics (Core / Extended / Pure / Stats)" },
      { key: "intl_physics", label: "Physics" },
      { key: "intl_chemistry", label: "Chemistry" },
      { key: "intl_biology", label: "Biology" },
      { key: "intl_english_fl", label: "English First Language" },
      { key: "intl_english_sl", label: "English as a Second Language (ESL)" },
      { key: "intl_cs", label: "Computer Science & ICT" },
      { key: "intl_business", label: "Business Studies" },
      { key: "intl_economics", label: "Economics" },
      { key: "intl_accounting", label: "Accounting" },
      { key: "arabic", label: "اللغة العربية لغير الناطقين بها / أولى" },
      { key: "other", label: "Subject Other / أخرى" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

export function getCountry(code: string | null | undefined): CountryConfig {
  const found = COUNTRIES.find((c) => c.code === code?.toUpperCase());
  return found ?? COUNTRIES[0]; // fallback to Egypt
}

export function detectCountryFromTimezone(tz?: string): CountryConfig {
  const zone = (tz || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "") || "").toLowerCase();
  if (zone.includes("qatar")) return getCountry("QA");
  if (zone.includes("riyadh") || zone.includes("saudi")) return getCountry("SA");
  if (zone.includes("dubai") || zone.includes("uae")) return getCountry("AE");
  if (zone.includes("kuwait")) return getCountry("KW");
  if (zone.includes("muscat") || zone.includes("oman")) return getCountry("OM");
  if (zone.includes("bahrain")) return getCountry("BH");
  if (zone.includes("amman") || zone.includes("jordan")) return getCountry("JO");
  if (zone.includes("cairo") || zone.includes("egypt")) return getCountry("EG");
  return getCountry("EG");
}

export function getCurriculum(id: string | null | undefined): CurriculumConfig {
  return CURRICULUMS.find((c) => c.id === id) ?? CURRICULUMS[0];
}

export function getCurriculumsForCountry(countryCode: string | null | undefined): CurriculumConfig[] {
  const code = countryCode?.toUpperCase() || "EG";
  return CURRICULUMS.filter((c) => c.country === code || c.country === "ALL");
}

export function getAllGradesForCurriculum(curriculumId: string): GradeItem[] {
  const cur = getCurriculum(curriculumId);
  return cur.stages.flatMap((s) => s.grades);
}

export function getTracksForGrade(curriculumId: string, gradeKey: string): Array<{ key: string; label: string }> {
  const cur = getCurriculum(curriculumId);
  const allGrades = getAllGradesForCurriculum(curriculumId);
  const g = allGrades.find((item) => item.key === gradeKey);
  if (!g?.tracks || !cur.tracks) return [];
  return cur.tracks.filter((t) => g.tracks!.includes(t.key));
}

export function getSubjectsFor(curriculumId: string, gradeKey?: string, trackKey?: string): SubjectItem[] {
  const cur = getCurriculum(curriculumId);
  let stageId: string | undefined;
  if (gradeKey) {
    for (const stage of cur.stages) {
      if (stage.grades.some((g) => g.key === gradeKey)) {
        stageId = stage.id;
        break;
      }
    }
  }

  return cur.subjects.filter((sub) => {
    if (stageId && sub.stages && sub.stages.length > 0) {
      if (!sub.stages.includes(stageId)) return false;
    }
    if (trackKey && sub.tracks && sub.tracks.length > 0) {
      if (!sub.tracks.includes(trackKey)) return false;
    }
    return true;
  });
}

export function formatCurrency(cents: number, currencyCode: string = "EGP"): string {
  const curr = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const val = cents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(val);
  return `${formatted} ${curr.symbol}`;
}

export function getCurrencyConfig(code: string = "EGP"): CurrencyConfig {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function normalizePhoneNumber(rawNumber: string, phoneCode: string): { fullPhone: string; isValid: boolean } {
  // Strip non-digits except leading +
  let cleaned = rawNumber.trim().replace(/[^\d+]/g, "");
  // If user entered local leading 0 (e.g. 010..., 050...), strip it
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.replace(/^0+/, "");
  }
  // If user already typed the international prefix, keep it
  if (cleaned.startsWith("+")) {
    return { fullPhone: cleaned, isValid: cleaned.length >= 8 && cleaned.length <= 16 };
  }
  const prefix = phoneCode.startsWith("+") ? phoneCode : `+${phoneCode}`;
  const fullPhone = `${prefix}${cleaned}`;
  return {
    fullPhone,
    isValid: cleaned.length >= 7 && cleaned.length <= 12,
  };
}

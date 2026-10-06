/** Accès UI par rôle — aligné sur docs/MATRICE_ROLES_ACCES.md */

export type ClubRole = "admin" | "direction" | "staff" | "coach" | "parent" | "superadmin";

export type NavItem = {
  to: string;
  labelKey: string;
  /** Libellé court mobile (FR / AR) */
  shortFr: string;
  shortAr: string;
  roles: ClubRole[] | null; // null = tous les rôles connectés
};

/** Navigation principale — ce qui est affichable par rôle */
export const NAV_BY_ROLE: NavItem[] = [
  { to: "/", labelKey: "dashboard", shortFr: "Accueil", shortAr: "رئيسية", roles: null },
  { to: "/platform", labelKey: "platformAdmin", shortFr: "Platform", shortAr: "منصة", roles: ["superadmin"] },
  { to: "/athletes", labelKey: "athletes", shortFr: "Joueurs", shortAr: "لاعبون", roles: ["admin", "direction", "staff", "coach"] },
  {
    to: "/registrations",
    labelKey: "registrations",
    shortFr: "Inscript.",
    shortAr: "تسجيل",
    roles: ["admin", "direction", "staff", "parent"],
  },
  { to: "/agenda", labelKey: "agenda", shortFr: "Agenda", shortAr: "جدول", roles: null },
  { to: "/teams", labelKey: "teams", shortFr: "Équipes", shortAr: "فرق", roles: ["admin", "direction", "staff", "coach"] },
  { to: "/users", labelKey: "accounts", shortFr: "Comptes", shortAr: "حسابات", roles: ["admin", "direction"] },
  { to: "/history", labelKey: "history", shortFr: "Histo.", shortAr: "سجل", roles: ["admin", "direction", "staff"] },
  {
    to: "/feedback-admin",
    labelKey: "feedbackAdmin",
    shortFr: "Feedback",
    shortAr: "آراء",
    roles: ["admin", "direction"],
  },
  { to: "/finance", labelKey: "finance", shortFr: "Finance", shortAr: "مالية", roles: ["admin", "direction", "staff"] },
  { to: "/inventory", labelKey: "inventory", shortFr: "Matériel", shortAr: "عتاد", roles: ["admin", "direction", "staff"] },
  { to: "/announcements", labelKey: "announcements", shortFr: "Annonces", shortAr: "إعلان", roles: null },
  { to: "/guide", labelKey: "guide", shortFr: "Guide", shortAr: "دليل", roles: null },
  { to: "/download", labelKey: "download", shortFr: "App", shortAr: "تطبيق", roles: null },
];

/** Routes protégées (URL directe) */
export const ROUTE_ALLOW: Record<string, ClubRole[]> = {
  "/platform": ["superadmin"],
  "/athletes": ["admin", "direction", "staff", "coach"],
  "/registrations": ["admin", "direction", "staff", "parent"],
  "/teams": ["admin", "direction", "staff", "coach"],
  "/users": ["admin", "direction"],
  "/history": ["admin", "direction", "staff"],
  "/feedback-admin": ["admin", "direction"],
  "/finance": ["admin", "direction", "staff"],
  "/inventory": ["admin", "direction", "staff"],
};

export function canAccessPath(role: string | null | undefined, path: string): boolean {
  const allow = ROUTE_ALLOW[path];
  if (!allow) return true;
  return !!role && allow.includes(role as ClubRole);
}

export function navForRole(role: string | null | undefined): NavItem[] {
  return NAV_BY_ROLE.filter((l) => !l.roles || (role && l.roles.includes(role as ClubRole)));
}

export function roleLabel(role: string | null | undefined, lang: "fr" | "ar"): string {
  const map: Record<string, { fr: string; ar: string }> = {
    admin: { fr: "Administrateur", ar: "مسؤول" },
    direction: { fr: "Direction", ar: "إدارة" },
    staff: { fr: "Staff", ar: "موظف" },
    coach: { fr: "Coach", ar: "مدرب" },
    parent: { fr: "Parent", ar: "ولي" },
    superadmin: { fr: "Super-admin plateforme", ar: "مشرف المنصة" },
  };
  if (!role) return "";
  const row = map[role];
  return row ? row[lang] : role;
}

export function roleSpaceTitle(role: string | null | undefined, lang: "fr" | "ar"): string {
  const map: Record<string, { fr: string; ar: string }> = {
    admin: { fr: "Espace administration", ar: "فضاء الإدارة" },
    direction: { fr: "Espace direction", ar: "فضاء المديرية" },
    staff: { fr: "Espace staff", ar: "فضاء الموظفين" },
    coach: { fr: "Espace coach", ar: "فضاء المدرب" },
    parent: { fr: "Espace parent", ar: "فضاء الولي" },
    superadmin: { fr: "Console plateforme", ar: "وحدة تحكم المنصة" },
  };
  if (!role) return lang === "ar" ? "فضاء المستخدم" : "Espace utilisateur";
  return map[role]?.[lang] || (lang === "ar" ? "فضاء المستخدم" : "Espace utilisateur");
}

/** Capacités UI (affichable / faisable) */
export function caps(role: string | null | undefined) {
  const r = role || "";
  const isAdminLike = r === "admin" || r === "direction";
  const isStaffOps = isAdminLike || r === "staff";
  return {
    isParent: r === "parent",
    isCoach: r === "coach",
    isStaffOps,
    isAdminLike,
    canPublishAnnouncements: isStaffOps,
    canManageUsers: isAdminLike,
    canSeeFinance: isStaffOps,
    canSeeInventory: isStaffOps,
    canSeeHistory: isStaffOps,
    canCreateSessions: isStaffOps || r === "coach",
    canApproveSessions: isStaffOps,
    canPointAttendance: isStaffOps || r === "coach",
    canRegisterPlayers: isStaffOps || r === "parent",
    canManageTeamsStructure: isStaffOps,
    canAssignCoaches: isAdminLike,
  };
}

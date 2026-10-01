/** Contenu formation Nadi Connect — FR / AR, étapes + interdits. */

export type GuideBlock =
  | { type: "p"; fr: string; ar: string }
  | { type: "steps"; titleFr: string; titleAr: string; itemsFr: string[]; itemsAr: string[] }
  | { type: "do"; titleFr?: string; titleAr?: string; itemsFr: string[]; itemsAr: string[] }
  | { type: "dont"; titleFr?: string; titleAr?: string; itemsFr: string[]; itemsAr: string[] }
  | { type: "note"; fr: string; ar: string };

export type GuideChapter = {
  id: string;
  titleFr: string;
  titleAr: string;
  blocks: GuideBlock[];
};

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: "intro",
    titleFr: "0. Bienvenue — Nadi Connect",
    titleAr: "0. مرحباً — نادي كونكت",
    blocks: [
      {
        type: "p",
        fr: "Nadi Connect (« Nadi » = club en arabe) est le système de gestion du club sportif : inscriptions, athlètes, agenda, finance, parents, matériel. Un club = un espace isolé (code / slug).",
        ar: "نادي كونكت (نادي = club) نظام تسيير النادي: تسجيلات، لاعبون، جدول، مالية، أولياء، عتاد. كل نادٍ معزول برمز خاص.",
      },
      {
        type: "p",
        fr: "Ce guide est une formation d’utilisation complète : quoi faire, dans quel ordre, et surtout quoi ne jamais faire.",
        ar: "هذا الدليل تكوين استعمال كامل: ماذا تفعل، بأي ترتيب، وما يجب تجنّبه.",
      },
      {
        type: "do",
        titleFr: "Toujours",
        titleAr: "دائماً",
        itemsFr: [
          "Choisir le bon club (slug) avant de se connecter",
          "Vérifier votre rôle (admin / direction / staff / coach / parent)",
          "Préférer Archiver à Supprimer définitif",
          "Contrôler le téléphone parent (format DZ 05/06/07…)",
        ],
        itemsAr: [
          "اختيار رمز النادي الصحيح قبل الدخول",
          "التحقق من دورك",
          "تفضيل الأرشفة على الحذف النهائي",
          "التحقق من هاتف الولي (05/06/07…)",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas partager le mot de passe admin",
          "Ne pas supprimer une inscription pour « corriger » un numéro — utilisez la modification",
          "Ne pas confondre N° joueur (1, 2, 57…) avec l’id technique caché de la base",
          "Ne pas travailler sur le mauvais club (ex. démo au lieu du club réel)",
        ],
        itemsAr: [
          "عدم مشاركة كلمة مرور المدير",
          "عدم حذف تسجيل فقط لتصحيح رقم — عدّل الملف",
          "عدم الخلط بين رقم اللاعب ومعرّف قاعدة البيانات",
          "عدم العمل على نادٍ خاطئ",
        ],
      },
    ],
  },
  {
    id: "login",
    titleFr: "1. Connexion & premier accès",
    titleAr: "1. الدخول والوصول الأول",
    blocks: [
      {
        type: "steps",
        titleFr: "Se connecter (staff / coach)",
        titleAr: "دخول الطاقم / المدرب",
        itemsFr: [
          "Ouvrir le site → Connexion (ou /login)",
          "Choisir le club dans la liste (ou saisir le code club)",
          "Saisir l’e-mail du compte + mot de passe",
          "Valider → vous arrivez sur le Tableau de bord (ou Accueil parent)",
        ],
        itemsAr: [
          "افتح الموقع → دخول",
          "اختر النادي (أو اكتب رمز النادي)",
          "أدخل البريد وكلمة المرور",
          "أكد → لوحة التحكم",
        ],
      },
      {
        type: "steps",
        titleFr: "Se connecter (parent)",
        titleAr: "دخول الولي",
        itemsFr: [
          "Choisir le même club que celui de l’enfant",
          "Saisir le numéro de téléphone parent enregistré à l’inscription (sans espaces inutiles)",
          "Mot de passe reçu / défini à l’inscription",
          "Accueil parent : enfants, séances, notifications",
        ],
        itemsAr: [
          "اختر نفس نادي الابن",
          "أدخل هاتف الولي المسجّل",
          "كلمة المرور المعرّفة عند التسجيل",
          "شاشة الأولياء: الأبناء والحصص والإشعارات",
        ],
      },
      {
        type: "steps",
        titleFr: "Créer un nouveau club (essai 14 jours)",
        titleAr: "إنشاء نادٍ جديد (تجربة 14 يوماً)",
        itemsFr: [
          "Aller sur Offres (/pricing) ou « Créer un club » (/onboard)",
          "Nom du club, slug unique, sports (un ou plusieurs)",
          "Compte admin : nom, e-mail, mot de passe fort",
          "Valider → connexion avec le nouveau slug",
        ],
        itemsAr: [
          "العروض أو إنشاء نادي",
          "الاسم والرمز والرياضات",
          "حساب مدير بكلمة مرور قوية",
          "ثم الدخول بالرمز الجديد",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas réutiliser un slug déjà pris",
          "Ne pas laisser le navigateur enregistrer le MDP admin sur un PC partagé",
          "Si « Failed to fetch » : vérifier Internet, réveiller le serveur (bouton Actualiser), puis Réessayer",
        ],
        itemsAr: [
          "لا تستخدم رمزاً مستعملاً",
          "لا تحفظ كلمة المدير على جهاز مشترك",
          "عند فشل الشبكة: تحقق من الإنترنت ثم أعد المحاولة",
        ],
      },
    ],
  },
  {
    id: "roles",
    titleFr: "2. Rôles — qui peut faire quoi",
    titleAr: "2. الأدوار — من يفعل ماذا",
    blocks: [
      {
        type: "p",
        fr: "Les menus s’adaptent au rôle. Si un bouton n’apparaît pas, c’est souvent volontaire (pas un bug).",
        ar: "القوائم تتغيّر حسب الدور. غياب زر غالباً مقصود وليس عطلاً.",
      },
      {
        type: "do",
        titleFr: "Résumé des rôles",
        titleAr: "ملخص الأدوار",
        itemsFr: [
          "Admin : tout + créer comptes + corbeille avancée",
          "Direction : pilotage, finance, comptes (sauf créer un autre admin selon règles)",
          "Staff : inscriptions, agenda, finance, matériel au quotidien",
          "Coach : athlètes/équipes assignés, agenda, présences — PAS le menu Finance club",
          "Parent : ses enfants uniquement — PAS Comptes / Finance / Corbeille staff",
        ],
        itemsAr: [
          "المدير: كل شيء + الحسابات",
          "الإدارة: التسيير والمالية والحسابات",
          "الموظفون: التسجيلات والجدول والمالية اليومية",
          "المدرب: الفرق والحضور — بدون مالية النادي",
          "الولي: أبناؤه فقط",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas donner le rôle admin « pour aller plus vite » à tout le monde",
          "Ne pas demander à un parent d’utiliser un compte staff",
          "Ne pas contourner les droits en prêtant sa session",
        ],
        itemsAr: [
          "لا تعطِ دور المدير للجميع",
          "لا تطلب من ولي استعمال حساب طاقم",
          "لا تُعر جلسات الدخول",
        ],
      },
    ],
  },
  {
    id: "map",
    titleFr: "3. Carte du système (relations)",
    titleAr: "3. خريطة النظام (العلاقات)",
    blocks: [
      {
        type: "p",
        fr: "Comprendre les liens évite les erreurs de saisie.",
        ar: "فهم الروابط يقلل أخطاء الإدخال.",
      },
      {
        type: "steps",
        titleFr: "Chaîne principale",
        titleAr: "السلسلة الرئيسية",
        itemsFr: [
          "Club → Saison courante",
          "Saison → Disciplines (sports) → Catégories d’âge",
          "Catégories → Équipes → Coachs assignés",
          "Athlète lié à Parent (téléphone)",
          "Inscription = Athlète + Saison + Catégorie (+ Kit + N° joueur)",
          "Inscription → Échéances / cotisations → Paiements",
          "Agenda (séances) → Présences → Notifications parents",
        ],
        itemsAr: [
          "النادي → الموسم الحالي",
          "الموسم → الرياضات → فئات العمر",
          "الفئات → الفرق → المدربون",
          "اللاعب مرتبط بالولي (هاتف)",
          "التسجيل = لاعب + موسم + فئة (+ عدة + رقم)",
          "التسجيل → اشتراكات → مدفوعات",
          "الجدول → الحضور → إشعارات الأولياء",
        ],
      },
      {
        type: "note",
        fr: "N° joueur = rang de la saison (1…N), affiché dans Athlètes et Inscriptions. Ce n’est PAS le numéro secret de la base de données.",
        ar: "رقم اللاعب = ترتيب الموسم وليس رقم قاعدة البيانات الداخلي.",
      },
    ],
  },
  {
    id: "dashboard",
    titleFr: "4. Tableau de bord",
    titleAr: "4. لوحة التحكم",
    blocks: [
      {
        type: "steps",
        titleFr: "Lire le tableau de bord",
        titleAr: "قراءة اللوحة",
        itemsFr: [
          "Menu Accueil / Tableau de bord",
          "Lire les cartes : athlètes, actifs, parents, séances, inscriptions en attente, impayés",
          "Utiliser les segments (3 / 6 / 12 mois, vue Sport / Finance)",
          "Si graphes vides : cliquer Réessayer ; vérifier la connexion",
        ],
        itemsAr: [
          "القائمة الرئيسية",
          "اقرأ البطاقات والمؤشرات",
          "استخدم الفترات 3/6/12 شهراً",
          "إن كانت الرسوم فارغة: أعد المحاولة",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas conclure « 0 joueurs » sans vérifier le filtre segments / masquer zéros",
          "Parent : vous n’avez pas les graphes club — c’est normal (vue enfants)",
        ],
        itemsAr: [
          "لا تستنتج صفر لاعبين دون التحقق من الفلاتر",
          "الولي لا يرى رسوم النادي — هذا طبيعي",
        ],
      },
    ],
  },
  {
    id: "athletes",
    titleFr: "5. Athlètes — créer, modifier, archiver",
    titleAr: "5. اللاعبون — إنشاء وتعديل وأرشفة",
    blocks: [
      {
        type: "steps",
        titleFr: "Créer un athlète (sans inscription complète)",
        titleAr: "إنشاء لاعب",
        itemsFr: [
          "Menu Athlètes",
          "Remplir : nom, date/lieu de naissance, téléphone parent, photo optionnelle, groupe sanguin",
          "Enregistrer",
          "Vérifier que le parent téléphone est valide (DZ)",
        ],
        itemsAr: [
          "قائمة اللاعبين",
          "الاسم وتاريخ الميلاد وهاتف الولي والصورة",
          "حفظ",
          "تحقق من صحة الهاتف",
        ],
      },
      {
        type: "steps",
        titleFr: "Modifier une fiche",
        titleAr: "تعديل بطاقة",
        itemsFr: [
          "Cliquer Modifier sur la ligne",
          "Corriger nom, naissance, téléphone, photo, statut, notes",
          "Enregistrer — le N° joueur d’inscription n’est pas « inventé » ici",
        ],
        itemsAr: [
          "اضغط تعديل",
          "صحّح البيانات",
          "حفظ — رقم التسجيل يُدار من صفحة التسجيلات",
        ],
      },
      {
        type: "steps",
        titleFr: "Archiver un joueur",
        titleAr: "أرشفة لاعب",
        itemsFr: [
          "Bouton Archiver (admin / direction) → statut Abandonne",
          "Le joueur disparaît de la liste « actifs » par défaut",
          "Récupérable via filtre statut / Historique",
        ],
        itemsAr: [
          "أرشفة → حالة متخلّى",
          "يختفي من القائمة الافتراضية",
          "يمكن استرجاعه لاحقاً",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas créer deux fois le même enfant (même nom + même date) — le système refuse le doublon",
          "Ne pas supprimer définitivement sans passer par la procédure admin (irréversible ou difficile)",
          "Ne pas utiliser le téléphone d’un autre parent « temporairement »",
        ],
        itemsAr: [
          "لا تنشئ نفس الطفل مرتين",
          "لا تحذف نهائياً بدون إجراء واضح",
          "لا تستخدم هاتف ولي آخر مؤقتاً",
        ],
      },
    ],
  },
  {
    id: "regs",
    titleFr: "6. Inscriptions — guide opérationnel",
    titleAr: "6. التسجيلات — دليل عملي",
    blocks: [
      {
        type: "p",
        fr: "L’inscription est le dossier saison : elle lie le joueur à la catégorie, attribue N° joueur + kit, et ouvre la voie aux cotisations.",
        ar: "التسجيل ملف الموسم: يربط اللاعب بالفئة ويعطي الرقم والعدة ويفتح الاشتراكات.",
      },
      {
        type: "steps",
        titleFr: "Inscrire un nouveau joueur (parcours recommandé)",
        titleAr: "تسجيل لاعب جديد",
        itemsFr: [
          "Menu Inscriptions → Nouvelle inscription",
          "Saisir identité joueur + photo",
          "Téléphone parent (obligatoire pour le compte parent) + nom parent",
          "Choisir saison + catégorie (âge) + équipe si besoin",
          "Kit : n° équipement / maillot / sac selon le formulaire",
          "Enregistrer → noter le N° joueur et la Référence affichés",
          "Informer le parent de son téléphone + mot de passe temporaire si généré",
        ],
        itemsAr: [
          "التسجيلات → تسجيل جديد",
          "بيانات اللاعب والصورة",
          "هاتف واسم الولي",
          "الموسم والفئة والفريق",
          "العدة / القميص",
          "حفظ وتسجيل الرقم والمرجع",
          "أخبر الولي ببيانات الدخول",
        ],
      },
      {
        type: "steps",
        titleFr: "Modifier une inscription",
        titleAr: "تعديل تسجيل",
        itemsFr: [
          "Ouvrir la ligne → Modifier",
          "Changer catégorie, kit, notes, statut selon besoin",
          "La Référence historique reste figée (identité du dossier)",
          "Enregistrer",
        ],
        itemsAr: [
          "عدّل الفئة أو العدة أو الحالة",
          "المرجع التاريخي يبقى ثابتاً",
          "حفظ",
        ],
      },
      {
        type: "steps",
        titleFr: "Archiver / annuler un dossier",
        titleAr: "أرشفة / إلغاء ملف",
        itemsFr: [
          "Utiliser le statut archivé / procédure affichée dans l’écran",
          "Le N° / référence ne sont pas « recyclés » pour un autre enfant",
          "Vérifier Finance : échéances liées éventuelles",
        ],
        itemsAr: [
          "استخدم الأرشفة من الشاشة",
          "الرقم/المرجع لا يُعادان لطفل آخر",
          "تحقق من المالية المرتبطة",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas inventer un N° joueur à la main pour « faire joli » — le système calcule le rang",
          "Ne pas laisser une inscription sans téléphone parent valide",
          "Ne pas inscrire dans la mauvaise catégorie d’âge",
          "Hors ligne : si file d’attente offline, synchroniser avant de ressaisir (évite doublons)",
        ],
        itemsAr: [
          "لا تخترع رقم لاعب يدوياً",
          "لا تسجّل بدون هاتف ولي صالح",
          "لا تضع اللاعب في فئة عمر خاطئة",
          "عند العمل دون إنترنت: زامن قبل إعادة الإدخال",
        ],
      },
    ],
  },
  {
    id: "finance",
    titleFr: "7. Finance — cotisations, paiements, caisse",
    titleAr: "7. المالية — اشتراكات ومدفوعات وصندوق",
    blocks: [
      {
        type: "p",
        fr: "Réservé admin / direction / staff. Devise DZD. Chaque opération peut avoir une référence immuable (PAY / ECH / …).",
        ar: "للإدارة والموظفين. العملة دج. لكل عملية مرجع ثابت.",
      },
      {
        type: "steps",
        titleFr: "Enregistrer un paiement joueur (rapide)",
        titleAr: "تسجيل دفعة لاعب",
        itemsFr: [
          "Menu Finance (ou fiche Athlète → paiement rapide)",
          "Choisir le joueur",
          "Type : mensuel / assurance / autre selon options",
          "Montant + date + méthode (espèces, etc.)",
          "Valider → conserver le n° de reçu affiché",
        ],
        itemsAr: [
          "المالية أو بطاقة اللاعب",
          "اختر اللاعب",
          "نوع الدفعة والمبلغ والتاريخ",
          "أكد واحفظ رقم الوصل",
        ],
      },
      {
        type: "steps",
        titleFr: "Gérer les échéances (cotisations)",
        titleAr: "إدارة الأقساط",
        itemsFr: [
          "Onglet Cotisations / Échéances dans Finance",
          "Vérifier statut (due, partielle, payée, en retard)",
          "Modifier un montant / libellé si besoin (référence conservée)",
          "Supprimer une échéance seulement si erreur manifeste + confirmation",
        ],
        itemsAr: [
          "تبويب الاشتراكات",
          "تحقق من الحالة",
          "عدّل عند الحاجة",
          "احذف فقط عند خطأ واضح مع تأكيد",
        ],
      },
      {
        type: "steps",
        titleFr: "Caisse (recettes / dépenses)",
        titleAr: "الصندوق (إيرادات / مصاريف)",
        itemsFr: [
          "Créer une écriture : type, montant, date, libellé",
          "Modifier si erreur de saisie",
          "Supprimer = archive récupérable dans Historique (pas un oubli silencieux)",
        ],
        itemsAr: [
          "أنشئ قيداً: نوع ومبلغ وتاريخ",
          "عدّل عند الخطأ",
          "الحذف يؤرشف ويمكن استرجاعه من السجل",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas « corriger » un paiement en en créant un second négatif sans règle claire — modifier ou supprimer proprement",
          "Ne pas mélanger caisse club et cotisations joueur sans libellé clair",
          "Ne pas supprimer en masse sans export / backup",
          "Coach / parent : n’essayez pas d’accéder à Finance via URL — accès refusé",
        ],
        itemsAr: [
          "لا تصحح دفعة بإنشاء دفعة سالبة عشوائية",
          "لا تخلط صندوق النادي واشتراكات اللاعبين",
          "لا تحذف جماعياً بدون نسخة احتياطية",
          "المدرب/الولي لا يستعملان المالية",
        ],
      },
    ],
  },
  {
    id: "agenda",
    titleFr: "8. Agenda — séances et présences",
    titleAr: "8. الجدول — الحصص والحضور",
    blocks: [
      {
        type: "steps",
        titleFr: "Créer une séance",
        titleAr: "إنشاء حصة",
        itemsFr: [
          "Menu Agenda → Nouvelle séance / match",
          "Date, heure, lieu, équipe / catégorie, type",
          "Case « notifier parents » si besoin",
          "Enregistrer — selon réglages, validation staff peut être requise",
        ],
        itemsAr: [
          "الجدول → حصة جديدة",
          "التاريخ والوقت والمكان والفريق",
          "إشعار الأولياء إن لزم",
          "حفظ",
        ],
      },
      {
        type: "steps",
        titleFr: "Cycle terrain (coach)",
        titleAr: "دورة الميدان (مدرب)",
        itemsFr: [
          "Démarrer la séance",
          "Pointer les présences (présent / absent / retard / excusé)",
          "Terminer la séance",
          "Les parents reçoivent les notifs selon leurs préférences",
        ],
        itemsAr: [
          "ابدأ الحصة",
          "سجّل الحضور",
          "أنهِ الحصة",
          "الأولياء يستلمون الإشعارات حسب تفضيلاتهم",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas créer des séances « fantômes » pour tester en production sans les annuler",
          "Ne pas terminer une séance sans pointage si le club s’appuie sur les présences",
          "Ne pas notifier les parents pour une séance encore non validée si le club exige approbation",
        ],
        itemsAr: [
          "لا تنشئ حصصاً تجريبية دون إلغائها",
          "لا تُنه حصة دون حضور إذا كان النادي يعتمد عليه",
          "احترم قواعد الموافقة قبل إشعار الأولياء",
        ],
      },
    ],
  },
  {
    id: "teams",
    titleFr: "9. Équipes, sports et coachs",
    titleAr: "9. الفرق والرياضات والمدربون",
    blocks: [
      {
        type: "steps",
        titleFr: "Ajouter un sport au club",
        titleAr: "إضافة رياضة للنادي",
        itemsFr: [
          "Menu Équipes → section Sports du club",
          "Ajouter une discipline (ex. judo) avec catégories préremplies",
          "Vérifier les nouvelles catégories dans Inscriptions",
        ],
        itemsAr: [
          "الفرق → رياضات النادي",
          "أضف الرياضة مع فئاتها",
          "تحقق منها في التسجيلات",
        ],
      },
      {
        type: "steps",
        titleFr: "Créer une équipe et assigner un coach",
        titleAr: "إنشاء فريق وتعيين مدرب",
        itemsFr: [
          "Créer l’équipe sur une catégorie",
          "Assigner un ou plusieurs coachs (compte coach existant)",
          "Le coach ne voit que ce qui le concerne",
        ],
        itemsAr: [
          "أنشئ الفريق على فئة",
          "عيّن المدرب",
          "المدرب يرى ما يخصّه",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas créer 10 sports « au hasard » — seulement les disciplines réelles du club",
          "Ne pas laisser un coach sans équipe s’il doit pointer les présences",
        ],
        itemsAr: [
          "لا تضف رياضات عشوائية",
          "لا تترك مدرباً بلا فريق إن كان يحتاج الحضور",
        ],
      },
    ],
  },
  {
    id: "inventory",
    titleFr: "10. Matériel",
    titleAr: "10. العتاد",
    blocks: [
      {
        type: "steps",
        titleFr: "Gérer le stock",
        titleAr: "تسيير المخزون",
        itemsFr: [
          "Menu Matériel → créer / modifier un article",
          "Surveiller les alertes de stock bas",
          "Assigner un article à un athlète si le parcours le propose",
        ],
        itemsAr: [
          "العتاد → إنشاء/تعديل",
          "راقب تنبيهات النقص",
          "أسند للاعب عند الحاجة",
        ],
      },
      {
        type: "dont",
        itemsFr: ["Ne pas supprimer un article encore assigné sans régulariser l’attribution"],
        itemsAr: ["لا تحذف عنصراً ما زال مسنداً دون تسوية"],
      },
    ],
  },
  {
    id: "comms",
    titleFr: "11. Annonces, comptes, historique",
    titleAr: "11. الإعلانات والحسابات والسجل",
    blocks: [
      {
        type: "steps",
        titleFr: "Publier une annonce",
        titleAr: "نشر إعلان",
        itemsFr: [
          "Menu Annonces → Nouveau",
          "Titre, texte, audience (tous / ciblée selon options)",
          "Publier — visible côté parents selon règles",
        ],
        itemsAr: ["الإعلانات → جديد → نشر"],
      },
      {
        type: "steps",
        titleFr: "Créer un compte staff / coach",
        titleAr: "إنشاء حساب موظف / مدرب",
        itemsFr: [
          "Menu Comptes (admin / direction)",
          "Choisir le rôle, e-mail, mot de passe initial",
          "Demander le changement de mot de passe à la première connexion",
        ],
        itemsAr: ["الحسابات → الدور والبريد وكلمة مرور أولية"],
      },
      {
        type: "steps",
        titleFr: "Corbeille / Historique",
        titleAr: "السلة / السجل",
        itemsFr: [
          "Menu Historique / Corbeille",
          "Filtrer les éléments archivés / supprimés",
          "Restaurer si erreur",
        ],
        itemsAr: ["السجل → صفّ → استرجع عند الخطأ"],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas créer un second compte admin « de secours » avec MDP faible",
          "Ne pas vider la corbeille sans savoit ce que vous perdez",
        ],
        itemsAr: [
          "لا تنشئ مديراً احتياطياً بكلمة ضعيفة",
          "لا تُفرغ السلة دون معرفة ما ستفقده",
        ],
      },
    ],
  },
  {
    id: "parent",
    titleFr: "12. Parcours parent (site + app)",
    titleAr: "12. مسار الولي (موقع + تطبيق)",
    blocks: [
      {
        type: "steps",
        titleFr: "Utilisation parent",
        titleAr: "استعمال الولي",
        itemsFr: [
          "Connexion téléphone + club",
          "Voir les enfants liés",
          "Suivre agenda / convocations / RSVP",
          "Régler les préférences de notifications (profil)",
          "Installer l’APK via Télécharger l’app si besoin",
        ],
        itemsAr: [
          "دخول بالهاتف",
          "الأبناء",
          "الجدول والاستدعاءات",
          "تفضيلات الإشعارات",
          "تثبيت التطبيق عند الحاجة",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas modifier les données d’un autre enfant",
          "Ne pas désactiver toutes les notifs puis se plaindre de n’avoir « rien reçu »",
        ],
        itemsAr: [
          "لا تعدّل بيانات ابن آخر",
          "لا تغلق كل الإشعارات ثم تعترض على عدم الاستلام",
        ],
      },
    ],
  },
  {
    id: "checklist",
    titleFr: "13. Check-lists formation (à cocher)",
    titleAr: "13. قوائم تحقق للتكوين",
    blocks: [
      {
        type: "steps",
        titleFr: "Secrétariat — 45 min",
        titleAr: "السكرتارية — 45 د",
        itemsFr: [
          "□ Connexion club correct",
          "□ Créer une inscription complète + photo",
          "□ Vérifier N° joueur = même sur Athlètes",
          "□ Enregistrer un paiement",
          "□ Publier une annonce courte",
          "□ Archiver puis restaurer (test sur dossier démo)",
        ],
        itemsAr: [
          "□ دخول صحيح",
          "□ تسجيل كامل",
          "□ تطابق رقم اللاعب",
          "□ دفعة",
          "□ إعلان",
          "□ أرشفة ثم استرجاع (تجريبي)",
        ],
      },
      {
        type: "steps",
        titleFr: "Coach — 30 min",
        titleAr: "المدرب — 30 د",
        itemsFr: [
          "□ Voir son équipe",
          "□ Créer / démarrer une séance",
          "□ Pointer 3 présences",
          "□ Terminer la séance",
        ],
        itemsAr: ["□ الفريق □ حصة □ حضور □ إنهاء"],
      },
      {
        type: "steps",
        titleFr: "Direction — 30 min",
        titleAr: "الإدارة — 30 د",
        itemsFr: [
          "□ Lire le tableau de bord",
          "□ Voir Finance (impayés)",
          "□ Créer un compte coach",
          "□ Parcourir Offres / Guide",
        ],
        itemsAr: ["□ اللوحة □ المالية □ حساب مدرب □ الدليل"],
      },
    ],
  },
  {
    id: "errors",
    titleFr: "14. Erreurs fréquentes & dépannage",
    titleAr: "14. أخطاء شائعة وحلول",
    blocks: [
      {
        type: "do",
        titleFr: "Que faire si…",
        titleAr: "ماذا تفعل إذا…",
        itemsFr: [
          "Failed to fetch → Internet + bouton Actualiser / Réveiller + F5",
          "Session expirée → se reconnecter",
          "403 / accès refusé → mauvais rôle ou mauvais club",
          "Doublon joueur → chercher l’existant, ne pas forcer une 2ᵉ création",
          "Graphes vides → Réessayer ; vérifier qu’il y a bien des données saison",
          "Parent ne voit pas l’enfant → téléphone différent de celui de l’inscription",
        ],
        itemsAr: [
          "فشل الجلب → إنترنت + إيقاظ + تحديث",
          "انتهت الجلسة → أعد الدخول",
          "مرفوض → دور أو نادٍ خاطئ",
          "تكرار لاعب → ابحث عن الموجود",
          "رسوم فارغة → أعد المحاولة",
          "الولي لا يرى الابن → هاتف مختلف عن التسجيل",
        ],
      },
      {
        type: "dont",
        itemsFr: [
          "Ne pas créer 5 comptes « pour tester » sans les désactiver après",
          "Ne pas modifier la date système du téléphone pour « forcer » une séance",
        ],
        itemsAr: [
          "لا تترك حسابات تجريبية كثيرة نشطة",
          "لا تلاعب بتاريخ الهاتف لفرض حصة",
        ],
      },
    ],
  },
  {
    id: "glossary",
    titleFr: "15. Lexique",
    titleAr: "15. معجم",
    blocks: [
      {
        type: "do",
        itemsFr: [
          "Slug / code club : identifiant court (ex. mon-club, demo-judo-978)",
          "N° joueur (list_number) : rang saison visible",
          "Référence : identité historique figée du dossier",
          "Kit : n° équipement maillot/sac",
          "Archiver : retirer de l’actif sans détruire l’historique",
          "Discovery : essai 14 jours",
        ],
        itemsAr: [
          "رمز النادي (slug)",
          "رقم اللاعب للموسم",
          "المرجع التاريخي",
          "العدة",
          "الأرشفة",
          "تجربة 14 يوماً",
        ],
      },
      {
        type: "note",
        fr: "Document lié : docs/GUIDE_FORMATION_NADI_CONNECT.md · Matrice rôles · Script démo commerciale.",
        ar: "مستندات مرتبطة في مجلد docs.",
      },
    ],
  },
];

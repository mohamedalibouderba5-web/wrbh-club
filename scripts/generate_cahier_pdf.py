#!/usr/bin/env python3
"""Génère docs/CAHIER_DES_CHARGES_WRBH.pdf — design pro WRBH."""
from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "CAHIER_DES_CHARGES_WRBH.pdf"
LOGO = ROOT / "assets" / "logo-wrbh.png"
if not LOGO.exists():
    LOGO = ROOT / "web" / "public" / "logo.png"

# Brand
BLUE = colors.HexColor("#1E3A8A")
BLUE_DEEP = colors.HexColor("#0F1F4D")
YELLOW = colors.HexColor("#F5C518")
INK = colors.HexColor("#0B1224")
MUTED = colors.HexColor("#5B6478")
BG_SOFT = colors.HexColor("#EEF2FB")
LINE = colors.HexColor("#D7DEEE")
WHITE = colors.white
OK = colors.HexColor("#1F7A4D")
WARN = colors.HexColor("#B45309")


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=32,
            textColor=WHITE,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            textColor=YELLOW,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#C8D2EA"),
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=BLUE_DEEP,
            spaceBefore=16,
            spaceAfter=8,
            borderPadding=3,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=BLUE,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=INK,
            leftIndent=8,
            spaceAfter=2,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
        ),
        "th": ParagraphStyle(
            "th",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=WHITE,
        ),
        "td": ParagraphStyle(
            "td",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=INK,
        ),
        "quote": ParagraphStyle(
            "quote",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=14,
            textColor=BLUE_DEEP,
            alignment=TA_CENTER,
            spaceBefore=8,
            spaceAfter=8,
        ),
        "footer": ParagraphStyle(
            "footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc": ParagraphStyle(
            "toc",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=16,
            textColor=INK,
            leftIndent=4,
        ),
    }
    return s


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # top bar
    canvas.setFillColor(BLUE_DEEP)
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, h - 12.8 * mm, w, 2.2, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(18 * mm, h - 7.5 * mm, "WRBH Club  ·  Cahier des charges SaaS")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 18 * mm, h - 7.5 * mm, "Passation développeur · Confidentiel")

    # bottom
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 8 * mm, "Gestion Clubs Sportifs — WRBH → Commercial")
    canvas.drawRightString(w - 18 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(story, s):
    # Full-bleed cover via a big table block
    cover_data = [[Paragraph("CAHIER DES CHARGES", s["cover_title"])]]
    cover_data.append(
        [Paragraph("SaaS de gestion des clubs sportifs", s["cover_sub"])]
    )
    cover_data.append(
        [
            Paragraph(
                "Widad Riadi Baladiat Hammadi (WRBH)<br/>الوداد الرياضي لبلدية حمادي",
                s["cover_meta"],
            )
        ]
    )
    cover_data.append(
        [
            Paragraph(
                "Document de passation pour développeur humain<br/>"
                "Vision commerciale multi-tenant · FR + AR · DZD<br/><br/>"
                "<b>Version API live 1.11.0</b>  ·  28 juillet 2026<br/>"
                "GitHub · mohamedalibouderba5-web/wrbh-club",
                s["cover_meta"],
            )
        ]
    )

    inner = Table(cover_data, colWidths=[15.5 * cm])
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BLUE_DEEP),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), 36),
                ("TOPPADDING", (0, 1), (-1, -1), 10),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 40),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("BOX", (0, 0), (-1, -1), 0, BLUE_DEEP),
            ]
        )
    )

    # yellow accent strip table
    accent = Table([[""]], colWidths=[15.5 * cm], rowHeights=[6])
    accent.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), YELLOW)]))

    story.append(Spacer(1, 2.2 * cm))
    story.append(accent)
    story.append(inner)
    story.append(accent)
    story.append(Spacer(1, 1.2 * cm))

    links = Table(
        [
            [
                Paragraph("<b>Web</b><br/>wrbh-web.onrender.com", s["td"]),
                Paragraph("<b>API</b><br/>wrbh-api.onrender.com", s["td"]),
                Paragraph("<b>Health</b><br/>/health → v1.11.0", s["td"]),
            ]
        ],
        colWidths=[5.1 * cm, 5.2 * cm, 5.2 * cm],
    )
    links.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(links)
    story.append(Spacer(1, 1 * cm))
    story.append(
        Paragraph(
            "Ce document décrit le logiciel existant (WRBH en production), "
            "le guide d’utilisation, l’architecture, la roadmap SaaS commerciale "
            "et l’organisation du travail entre développeur humain et Cursor.",
            s["body"],
        )
    )
    story.append(PageBreak())


def section_title(story, s, num: str, title: str):
    bar = Table(
        [[Paragraph(f"{num}  {title}", s["h1"])]],
        colWidths=[15.5 * cm],
    )
    bar.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_SOFT),
                ("LINEBEFORE", (0, 0), (0, 0), 4, YELLOW),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(Spacer(1, 4))
    story.append(bar)
    story.append(Spacer(1, 6))


def p(story, s, text: str):
    story.append(Paragraph(text, s["body"]))


def bullets(story, s, items: list[str]):
    for it in items:
        story.append(Paragraph(f"•  {it}", s["bullet"]))
    story.append(Spacer(1, 4))


def nice_table(story, s, headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
    data = [[Paragraph(h, s["th"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, s["td"]) for c in row])
    if widths is None:
        w = 15.5 * cm / len(headers)
        widths = [w] * len(headers)
    t = Table(data, colWidths=widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), BG_SOFT))
        else:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), WHITE))
    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    story.append(Spacer(1, 8))


def callout(story, s, title: str, body: str, tone=BLUE):
    block = Table(
        [
            [Paragraph(f"<b>{title}</b>", s["td"])],
            [Paragraph(body, s["td"])],
        ],
        colWidths=[15.5 * cm],
    )
    block.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_SOFT),
                ("LINEBEFORE", (0, 0), (0, -1), 3.5, tone),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
            ]
        )
    )
    story.append(block)
    story.append(Spacer(1, 8))


def build():
    s = styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Cahier des charges — SaaS Gestion Clubs Sportifs (WRBH)",
        author="WRBH Club",
        subject="Passation développeur humain — vision SaaS commerciale",
    )
    story: list = []

    # —— COVER ——
    cover_page(story, s)

    # —— TOC ——
    section_title(story, s, "00", "Sommaire")
    toc_items = [
        "1. Problème métier & solutions",
        "2. Vision produit commerciale",
        "3. Utilisateurs & rôles",
        "4. Guide d’utilisation (écrans / boutons)",
        "5. Architecture & technologies",
        "6. API & données",
        "7. Déploiement & environnement",
        "8. Roadmap SaaS commercial",
        "9. Tarification cible",
        "10. Organisation humain + Cursor · DoD · Checklist",
    ]
    for i, item in enumerate(toc_items, 1):
        story.append(Paragraph(f"{item}", s["toc"]))
    story.append(Spacer(1, 8))
    callout(
        story,
        s,
        "Objectif du document",
        "Permettre à un développeur humain de reprendre le projet WRBH déjà en production "
        "et de construire, en parallèle de Cursor, une vraie version SaaS multi-clubs commerciale.",
        YELLOW,
    )
    story.append(PageBreak())

    # —— 1 ——
    section_title(story, s, "01", "Problème métier — pourquoi ce logiciel existe")
    story.append(Paragraph("1.1 Pain points des clubs (avant)", s["h2"]))
    bullets(
        story,
        s,
        [
            "<b>Inscriptions papier / Excel</b> : doublons, catégories U7–U13 mal calculées, photos perdues.",
            "<b>Cotisations floues</b> : qui a payé ? quelle échéance ? quel reçu ?",
            "<b>Parents non informés</b> : séances annulées, convocations, dettes.",
            "<b>Coachs</b> : présence / absence sans outil fiable.",
            "<b>Direction</b> : pas de tableau de bord (effectif, impayés, dépenses).",
            "<b>Multi-clubs demain</b> : chaque club veut son espace isolé.",
        ],
    )
    story.append(Paragraph("1.2 Solutions apportées aujourd’hui (WRBH live)", s["h2"]))
    nice_table(
        story,
        s,
        ["Problème", "Solution dans le logiciel"],
        [
            ["Fiches joueurs dispersées", "Module Athlètes + photos en base"],
            ["Inscriptions chaotiques", "Inscriptions + refs immuables 26-27/U13/0042"],
            ["Impayés invisibles", "Finance (échéances, paiements, caisse, achats)"],
            ["Séances / absences", "Agenda + présences + coach remplaçant"],
            ["Parents", "Compte téléphone + app mobile / PWA"],
            ["Coachs / équipes", "Équipes / Coachs"],
            ["Matériel", "Inventaire (achat / prêt)"],
            ["Erreurs terrain", "Bouton Feedback + collecteur auto"],
            ["Cold start Render free", "Bouton Réveiller le serveur"],
        ],
        [7.2 * cm, 8.3 * cm],
    )
    story.append(Paragraph("1.3 Ce que le logiciel n’est pas encore", s["h2"]))
    bullets(
        story,
        s,
        [
            "Marketplace multi-clubs self-serve (inscription club + facturation SaaS)",
            "Console superadmin plateforme",
            "Sous-domaines club.domaine.dz",
            "Paiement en ligne parents (CIB / Stripe…)",
            "SMS / WhatsApp transactionnel automatisé",
            "SLA commercial (Render free = cold start)",
        ],
    )

    # —— 2 ——
    section_title(story, s, "02", "Vision produit commerciale")
    story.append(
        Paragraph(
            "« Un SaaS de gestion pour clubs sportifs (football jeunes d’abord) : "
            "admin web + app parents/coachs, FR/AR, DZD, multi-tenant. »",
            s["quote"],
        )
    )
    bullets(
        story,
        s,
        [
            "<b>Client pilote / référence :</b> WRBH (club_id = 1)",
            "<b>Marché cible :</b> clubs amateurs / semi-pro Algérie, puis Maghreb",
            "<b>Modèle :</b> setup + abonnement annuel (voir section 9)",
        ],
    )
    story.append(Paragraph("Principes non négociables", s["h2"]))
    bullets(
        story,
        s,
        [
            "Ne jamais casser la production WRBH.",
            "club_id uniquement depuis JWT/session — jamais depuis l’input client.",
            "Accès inter-clubs → 404 (pas 403 révélateur).",
            "Pas de nouveaux hardcodes WRBH ; branding / catégories / tarifs configurables.",
            "Devise DZD, fuseau Africa/Algiers, UI FR + AR.",
            "« Terminé » = en ligne sur Render, pas seulement sur GitHub.",
        ],
    )

    # —— 3 ——
    section_title(story, s, "03", "Utilisateurs & rôles")
    nice_table(
        story,
        s,
        ["Rôle", "Qui", "Droits typiques"],
        [
            ["superadmin", "Plateforme (futur)", "Tous clubs — UI absente"],
            ["admin", "Secrétaire / admin club", "Tout le back-office club"],
            ["direction", "Bureau", "Stats, finance, validations"],
            ["staff", "Secrétariat", "Inscriptions, athlètes, finance"],
            ["coach", "Entraîneur", "Agenda, présences, ses équipes"],
            ["parent", "Tuteur légal", "Enfants, paiements, convocations"],
            ["player", "Joueur", "Enum présent — pas de surface"],
        ],
        [3.2 * cm, 5 * cm, 7.3 * cm],
    )
    p(
        story,
        s,
        "<b>Connexion :</b> staff par email · parent par téléphone DZ (05/06/07…) · "
        "mot de passe temporaire possible avec changement forcé (must_change_password).",
    )

    story.append(PageBreak())

    # —— 4 ——
    section_title(story, s, "04", "Guide d’utilisation (écrans & boutons)")
    story.append(Paragraph("4.1 Première connexion Web", s["h2"]))
    bullets(
        story,
        s,
        [
            "Ouvrir https://wrbh-web.onrender.com",
            "Si l’API dort (free tier) : attendre 30–60 s ou cliquer <b>Actualiser / Réveiller le serveur</b>.",
            "Choisir FR ou عربي.",
            "Saisir téléphone parent ou email staff + mot de passe.",
            "Si « Session expirée / Token invalide » → se reconnecter (purge auto).",
        ],
    )

    story.append(Paragraph("4.2 Cartographie des écrans", s["h2"]))
    nice_table(
        story,
        s,
        ["Route", "Écran", "Actions principales"],
        [
            ["/", "Tableau de bord", "Stats, graphiques catégories, finance, Réessayer"],
            ["/athletes", "Athlètes", "Ajouter, photo, filtres, tri (AR = nouveaux d’abord), éditer"],
            ["/registrations", "Inscriptions", "Créer, N°/Réf immuables, approuver, offline sync"],
            ["/agenda", "Agenda", "Séances, remplaçant, présences, annuler"],
            ["/teams", "Équipes / Coachs", "Affecter coachs"],
            ["/finance", "Finance", "4 sous-onglets : cotisations, paiements, achats, caisse"],
            ["/inventory", "Matériel", "Articles, achat, prêt / retour"],
            ["/announcements", "Annonces", "Publier FR/AR, épingler"],
            ["/download", "App", "APK Android + guide PWA"],
            ["Feedback (FAB)", "Réclamation", "Choisir fonctionnalité + décrire bug/idée"],
        ],
        [3.2 * cm, 3.5 * cm, 8.8 * cm],
    )

    story.append(Paragraph("4.3 Finance — sous-onglets & références immuables", s["h2"]))
    bullets(
        story,
        s,
        [
            "Cotisations / Échéances — formule + totaux en haut, tableau N°/Réf en bas",
            "Paiements joueurs — historique + reçus",
            "Achats — équipement",
            "Recettes / Dépenses — caisse (ledger)",
            "Édition autorisée <b>sans jamais écraser</b> N° / référence",
        ],
    )
    nice_table(
        story,
        s,
        ["Type", "Format exemple"],
        [
            ["Inscription", "26-27/U13/0001"],
            ["Paiement", "PAY/2026/00001"],
            ["Recette / Dépense", "REC/… · DEP/…"],
            ["Achat / Échéance", "ACH/… · ECH/…"],
        ],
        [6 * cm, 9.5 * cm],
    )
    p(
        story,
        s,
        "<b>Tarifs défaut WRBH (configurables) :</b> mensuel 800 DZD · assurance 1 500 · inscription 4 000.",
    )

    story.append(Paragraph("4.4 Application mobile (Expo)", s["h2"]))
    nice_table(
        story,
        s,
        ["Onglet", "Usage"],
        [
            ["Accueil", "Enfants, convocations, impayés"],
            ["Agenda", "Séances + réponses ; coach : présences"],
            ["Paiements", "Échéances ; staff peut encaisser"],
            ["Messages", "Annonces / fils"],
            ["Profil", "Infos + enfants"],
        ],
        [4 * cm, 11.5 * cm],
    )

    # —— 5 ——
    section_title(story, s, "05", "Architecture & technologies")
    callout(
        story,
        s,
        "Schéma",
        "Web React/Vite PWA + Mobile Expo  →  HTTPS JWT (role + club_id)  →  "
        "FastAPI /api/v1 (Render)  →  PostgreSQL (Aiven/Neon) + MediaObject (photos).",
        BLUE,
    )
    nice_table(
        story,
        s,
        ["Couche", "Technologie"],
        [
            ["API", "Python · FastAPI · SQLAlchemy · JWT · Alembic"],
            ["Web", "React 18 · Vite 6 · TypeScript · React Router"],
            ["Mobile", "Expo Router · AsyncStorage · package dz.wrbh.club"],
            ["DB", "PostgreSQL prod · SQLite dev"],
            ["Hosting", "Render (API Docker + Static) · GitHub"],
            ["i18n", "FR + AR · RTL"],
        ],
        [4 * cm, 11.5 * cm],
    )
    story.append(Paragraph("Monorepo", s["h2"]))
    nice_table(
        story,
        s,
        ["Dossier", "Rôle"],
        [
            ["backend/", "API, modèles, Alembic, tests"],
            ["web/", "Back-office + PWA"],
            ["mobile/", "App parents / coachs"],
            ["docs/", "Documentation (ce PDF inclus)"],
            ["data/", "Journal feedback / erreurs"],
        ],
        [4 * cm, 11.5 * cm],
    )
    story.append(Paragraph("Multi-tenant — état réel", s["h2"]))
    nice_table(
        story,
        s,
        ["Élément", "Statut"],
        [
            ["Colonne club_id + backfill WRBH=1", "Fait"],
            ["Isolation JWT", "Fait (partiel, NULL legacy toléré)"],
            ["Slug club + branding API", "API oui · UI login non"],
            ["Sous-domaines / onboarding / billing", "À faire"],
        ],
        [8 * cm, 7.5 * cm],
    )

    story.append(PageBreak())

    # —— 6 ——
    section_title(story, s, "06", "API & données (résumé)")
    p(story, s, "Base : <b>https://wrbh-api.onrender.com/api/v1</b>")
    nice_table(
        story,
        s,
        ["Préfixe", "Modules"],
        [
            ["/auth · /club · /system", "Login, me, users, branding, health, wake"],
            ["/athletes · /registrations", "CRUD, tri, approve/reject"],
            ["agenda / comms", "Events, attendance, annonces, threads"],
            ["finance · /inventory", "Échéances, paiements, caisse, paie, stock"],
            ["/mobile · /uploads · /feedback", "Home mobile, photos, collecteur"],
        ],
        [5.5 * cm, 10 * cm],
    )
    p(
        story,
        s,
        "Modèle cœur : Club → Seasons → Categories → Teams → Athletes · Registration · "
        "FeeInstallment → Payment → Receipt · Event → Convocation → Attendance · "
        "MediaObject · SystemFeedbackEvent. Détail Mermaid : docs/ERD.md.",
    )
    story.append(Paragraph("Fichiers Web ↔ routes", s["h2"]))
    nice_table(
        story,
        s,
        ["Route", "Fichier source"],
        [
            ["/login", "web/src/pages/LoginPage.tsx"],
            ["/", "DashboardPage.tsx"],
            ["/athletes", "AthletesPage.tsx"],
            ["/registrations", "RegistrationsPage.tsx"],
            ["/finance", "FinancePage.tsx (sous-onglets)"],
            ["Layout + Feedback", "AppLayout.tsx · FeedbackWidget.tsx"],
            ["API client", "web/src/api/client.ts"],
        ],
        [4.5 * cm, 11 * cm],
    )

    # —— 7 ——
    section_title(story, s, "07", "Déploiement & environnement")
    bullets(
        story,
        s,
        [
            "Workspace Render : <b>WRHB</b> (pas le compte ESTA) — services wrbh-api + wrbh-web",
            "Push main GitHub puis souvent <b>Manual Deploy → Deploy latest commit</b>",
            "Env API : DATABASE_URL, SECRET_KEY (≥24), ENVIRONMENT=production, CORS_ORIGINS…",
            "Env Web build : VITE_API_URL, VITE_ANDROID_APK_URL",
            "Ne jamais changer SECRET_KEY prod sans coordination (invalide tous les JWT)",
        ],
    )

    # —— 8 ——
    section_title(story, s, "08", "Roadmap SaaS commercial (développeur humain)")
    story.append(Paragraph("Chantier A — Stabiliser WRBH", s["h2"]))
    bullets(story, s, ["Bugs Feedback", "Perf / UX mobile web", "Sentry", "Backup Postgres documenté"])
    story.append(Paragraph("Chantier B — Multi-tenant produit", s["h2"]))
    bullets(
        story,
        s,
        [
            "Login sélection club par slug",
            "Durcir isolation (interdire NULL club_id)",
            "2 clubs de test + E2E isolation",
            "Console superadmin",
            "Sous-domaines (phase 2)",
        ],
    )
    story.append(Paragraph("Chantier C — Commercialisation", s["h2"]))
    bullets(
        story,
        s,
        [
            "Landing marketing",
            "Onboarding self-serve (créer club + admin)",
            "Plans discovery / club / academy + facturation",
            "Essai trial_ends_on · factures PDF",
        ],
    )
    story.append(Paragraph("Chantier D — Différenciation", s["h2"]))
    bullets(
        story,
        s,
        ["WhatsApp / SMS rappels", "Paiement en ligne parents", "Export Excel", "White-label"],
    )

    # —— 9 ——
    section_title(story, s, "09", "Tarification cible (à valider)")
    nice_table(
        story,
        s,
        ["Offre", "Contenu", "Prix indicatif"],
        [
            ["Setup", "Import, formation, mise en ligne", "~ 35 000 DZD one-shot"],
            ["Abonnement Club", "1 club, web + app, support", "15 000 – 25 000 DZD / an"],
            ["Academy / Premium", "White-label, support prioritaire", "À définir (> 25 k)"],
            ["Discovery", "Essai / petit club", "Plan enum déjà prévu"],
        ],
        [3.8 * cm, 6.2 * cm, 5.5 * cm],
    )
    p(
        story,
        s,
        "Pour un SaaS payant : passer l’API Render en always-on (supprimer le cold start).",
    )

    # —— 10 ——
    section_title(story, s, "10", "Organisation · DoD · Checklist passation")
    nice_table(
        story,
        s,
        ["Qui", "Fait quoi"],
        [
            ["Développeur humain", "Architecture SaaS, billing, onboarding, revue qualité"],
            ["Cursor (Auto)", "Features WRBH, correctifs Feedback, UI FR/AR, déploiements"],
            ["Product owner", "Priorités, validation terrain, tarifs, clubs pilotes"],
        ],
        [4 * cm, 11.5 * cm],
    )
    story.append(Paragraph("Definition of Done", s["h2"]))
    bullets(
        story,
        s,
        [
            "Code sur main GitHub",
            "Tests pytest verts (zones sensibles) + build web OK",
            "Déployé API + Web Render",
            "Pas de régression WRBH (login / inscriptions / finance)",
        ],
    )
    story.append(Paragraph("Checklist passation", s["h2"]))
    bullets(
        story,
        s,
        [
            "Accès GitHub wrbh-club",
            "Accès Render workspace WRHB",
            "Accès Postgres (URL dans Render Env — ne pas coller hors équipe)",
            "Comptes admin / coach / parent de test",
            "Lire ce PDF + docs/ERD.md + docs/DEPLOY.md",
            "Vérifier health version ≥ 1.11.0",
        ],
    )

    story.append(Spacer(1, 16))
    end = Table(
        [
            [
                Paragraph(
                    "<b>Fin du cahier des charges v1.0</b><br/>"
                    "Passation WRBH → SaaS commercial · Juillet 2026<br/>"
                    "Prochaine révision : après premier sprint onboarding + slug login",
                    s["cover_meta"],
                )
            ]
        ],
        colWidths=[15.5 * cm],
    )
    end.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BLUE_DEEP),
                ("TOPPADDING", (0, 0), (-1, -1), 16),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(end)

    doc.build(story, onFirstPage=_first_page, onLaterPages=header_footer)
    print(f"OK: {OUT}")


def _first_page(canvas, doc):
    # Cover: no standard header; light footer only
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w / 2, 10 * mm, "WRBH Club · Document de passation · Confidentiel")
    canvas.restoreState()


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build()

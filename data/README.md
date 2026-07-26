# Journal automatique des erreurs SaaS + feedback utilisateurs
#
# Fichiers générés par l'API (append-only) :
# - system_feedback.jsonl   → une ligne JSON par événement (date/heure, kind, target, message…)
# - ERROR_FEEDBACK_LATEST.md → résumé des ~80 dernières entrées (lecture agent)
#
# Quand vous demandez de « régler les erreurs », l'agent lit ces fichiers
# (ou GET /api/v1/feedback/events en admin) et traite les entrées récentes.

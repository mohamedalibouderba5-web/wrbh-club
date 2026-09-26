from enum import StrEnum


class Role(StrEnum):
    SUPERADMIN = "superadmin"  # plateforme SaaS — cross-club
    ADMIN = "admin"
    DIRECTION = "direction"
    STAFF = "staff"
    COACH = "coach"
    PARENT = "parent"
    PLAYER = "player"


STAFF_ROLES = {Role.ADMIN, Role.DIRECTION, Role.STAFF}
MANAGEMENT_ROLES = {Role.ADMIN, Role.DIRECTION}
COACH_PLUS = STAFF_ROLES | {Role.COACH}
# Peut être assigné comme entraîneur d'équipe (gérant + coach)
TEAM_COACH_ROLES = {Role.COACH, Role.DIRECTION, Role.STAFF, Role.ADMIN}
ALL_AUTH = set(Role)

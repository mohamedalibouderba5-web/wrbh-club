from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    DIRECTION = "direction"
    STAFF = "staff"
    COACH = "coach"
    PARENT = "parent"
    PLAYER = "player"


STAFF_ROLES = {Role.ADMIN, Role.DIRECTION, Role.STAFF}
MANAGEMENT_ROLES = {Role.ADMIN, Role.DIRECTION}
COACH_PLUS = STAFF_ROLES | {Role.COACH}
ALL_AUTH = set(Role)

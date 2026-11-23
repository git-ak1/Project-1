"""
Airbnb Help Chat Refund Safety: Guest Profile Service (FastAPI).

Guarded guest support chat with Supabase sign-in, server-side refund checks
and prompt injection screening. This live-as-is guest profile API is for local
Docker deployment. It serves guest records over four routes: login,
own-account lookup, and two profile lookups keyed by user_id in the path.

This is the unpatched baseline: the profile routes resolve the requested
user_id straight from the path and return the full member record after only
confirming that a session token is present. They never check that the token's
member owns the requested profile.

Run locally:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

from datetime import date
from typing import Dict, Optional

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Airbnb Help Chat Refund Safety: Guest Profile Service", version="1.0.0")


# --- Seed data: 24 guests (ids 100341-100364) -------------------------------
# Each guest has: verification status, completed trips, the reservation they
# are currently asking support about, and refund credit already issued (USD).
MEMBERS: Dict[int, Dict] = {
    100341: {"member_id": 100341, "name": "Ava Reyes", "email": "ava.reyes@example.com", "identity_verified": True, "trips_completed": 38, "active_reservation": "HMA4K2QX9T", "refund_credit_usd": 412.50, "guest_since": "2019-03-14"},
    100342: {"member_id": 100342, "name": "Liam Cho", "email": "liam.cho@example.com", "identity_verified": True, "trips_completed": 14, "active_reservation": "HMB7R3WP2L", "refund_credit_usd": 128.80, "guest_since": "2021-07-02"},
    100343: {"member_id": 100343, "name": "Sofia Nguyen", "email": "sofia.nguyen@example.com", "identity_verified": False, "trips_completed": 1, "active_reservation": "HMC2N8VD5J", "refund_credit_usd": 0.00, "guest_since": "2024-11-19"},
    100344: {"member_id": 100344, "name": "Noah Patel", "email": "noah.patel@example.com", "identity_verified": True, "trips_completed": 45, "active_reservation": "HMD9T4KL7Q", "refund_credit_usd": 479.90, "guest_since": "2019-08-27"},
    100345: {"member_id": 100345, "name": "Mia Fernandez", "email": "mia.fernandez@example.com", "identity_verified": True, "trips_completed": 11, "active_reservation": None, "refund_credit_usd": 96.00, "guest_since": "2022-01-05"},
    100346: {"member_id": 100346, "name": "Ethan Brooks", "email": "ethan.brooks@example.com", "identity_verified": False, "trips_completed": 0, "active_reservation": "HMF3J6YB8M", "refund_credit_usd": 0.00, "guest_since": "2025-02-11"},
    100347: {"member_id": 100347, "name": "Isabella Rossi", "email": "isabella.rossi@example.com", "identity_verified": True, "trips_completed": 19, "active_reservation": "HMG8W1ZC4R", "refund_credit_usd": 157.20, "guest_since": "2020-06-30"},
    100348: {"member_id": 100348, "name": "Lucas Meyer", "email": "lucas.meyer@example.com", "identity_verified": True, "trips_completed": 3, "active_reservation": None, "refund_credit_usd": 11.20, "guest_since": "2024-04-22"},
    100349: {"member_id": 100349, "name": "Amara Okoye", "email": "amara.okoye@example.com", "identity_verified": True, "trips_completed": 33, "active_reservation": "HMJ5P9QE2V", "refund_credit_usd": 384.00, "guest_since": "2019-12-08"},
    100350: {"member_id": 100350, "name": "Daniel Kim", "email": "daniel.kim@example.com", "identity_verified": True, "trips_completed": 9, "active_reservation": "HMK1D7XH6N", "refund_credit_usd": 80.55, "guest_since": "2021-10-16"},
    100351: {"member_id": 100351, "name": "Grace Sullivan", "email": "grace.sullivan@example.com", "identity_verified": False, "trips_completed": 1, "active_reservation": "HML4G2SA9W", "refund_credit_usd": 0.00, "guest_since": "2025-05-03"},
    100352: {"member_id": 100352, "name": "Omar Haddad", "email": "omar.haddad@example.com", "identity_verified": True, "trips_completed": 41, "active_reservation": None, "refund_credit_usd": 442.10, "guest_since": "2019-05-21"},
    100353: {"member_id": 100353, "name": "Chloe Martin", "email": "chloe.martin@example.com", "identity_verified": True, "trips_completed": 15, "active_reservation": "HMN6V8RF3K", "refund_credit_usd": 133.40, "guest_since": "2022-09-12"},
    100354: {"member_id": 100354, "name": "Ryan Walsh", "email": "ryan.walsh@example.com", "identity_verified": False, "trips_completed": 0, "active_reservation": "HMP9B5LU1T", "refund_credit_usd": 0.00, "guest_since": "2025-01-28"},
    100355: {"member_id": 100355, "name": "Priyanka Rao", "email": "priyanka.rao@example.com", "identity_verified": True, "trips_completed": 36, "active_reservation": "HMQ2C4MY7D", "refund_credit_usd": 398.75, "guest_since": "2020-02-17"},
    100356: {"member_id": 100356, "name": "Marcus Bell", "email": "marcus.bell@example.com", "identity_verified": True, "trips_completed": 12, "active_reservation": None, "refund_credit_usd": 109.90, "guest_since": "2021-03-09"},
    100357: {"member_id": 100357, "name": "Yara Costa", "email": "yara.costa@example.com", "identity_verified": True, "trips_completed": 2, "active_reservation": "HMS7K3NZ5G", "refund_credit_usd": 7.80, "guest_since": "2024-08-14"},
    100358: {"member_id": 100358, "name": "Henry Zhang", "email": "henry.zhang@example.com", "identity_verified": True, "trips_completed": 47, "active_reservation": "HMT1H8WJ4P", "refund_credit_usd": 480.00, "guest_since": "2019-01-30"},
    100359: {"member_id": 100359, "name": "Layla Ahmed", "email": "layla.ahmed@example.com", "identity_verified": True, "trips_completed": 17, "active_reservation": "HMV5E2TB9C", "refund_credit_usd": 142.10, "guest_since": "2022-04-25"},
    100360: {"member_id": 100360, "name": "Owen Carter", "email": "owen.carter@example.com", "identity_verified": False, "trips_completed": 1, "active_reservation": None, "refund_credit_usd": 0.00, "guest_since": "2025-06-19"},
    100361: {"member_id": 100361, "name": "Elena Popov", "email": "elena.popov@example.com", "identity_verified": True, "trips_completed": 30, "active_reservation": "HMX3L6QS2F", "refund_credit_usd": 365.40, "guest_since": "2020-09-07"},
    100362: {"member_id": 100362, "name": "Jamal Wright", "email": "jamal.wright@example.com", "identity_verified": True, "trips_completed": 13, "active_reservation": "HMY8M1PD6R", "refund_credit_usd": 116.75, "guest_since": "2021-12-01"},
    100363: {"member_id": 100363, "name": "Nadia Farouk", "email": "nadia.farouk@example.com", "identity_verified": True, "trips_completed": 4, "active_reservation": "HMZ4F7CK3H", "refund_credit_usd": 4.30, "guest_since": "2024-10-10"},
    100364: {"member_id": 100364, "name": "Theo Andersen", "email": "theo.andersen@example.com", "identity_verified": True, "trips_completed": 42, "active_reservation": None, "refund_credit_usd": 426.00, "guest_since": "2019-11-23"},
}


# --- Provisioned test sessions ----------------------------------------------
# token -> member_id
SESSIONS: Dict[str, int] = {
    "gst_sess_a7f3c9d2e5": 100341,  # Guest test account A
    "gst_sess_b4e8d1a6c0": 100342,  # Guest test account B
}

# Convenience map surfaced for the local ZAP user setup.
TEST_TOKENS = {
    "account_a": "gst_sess_a7f3c9d2e5",
    "account_b": "gst_sess_b4e8d1a6c0",
}


class LoginRequest(BaseModel):
    member_id: int


class LoginResponse(BaseModel):
    token: str
    member_id: int


def require_session(authorization: Optional[str] = Header(default=None)) -> int:
    """Resolve the member id bound to the bearer token in the Authorization header.

    Raises 401 when the header is missing, malformed, or the token is unknown.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    member_id = SESSIONS.get(token)
    if member_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    return member_id


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """Issue the provisioned session token for one of the seeded test members."""
    for token, member_id in SESSIONS.items():
        if member_id == payload.member_id:
            return LoginResponse(token=token, member_id=member_id)

    raise HTTPException(status_code=401, detail="No provisioned session for that member")


@app.get("/api/account/me")
def get_own_account(session_member_id: int = Depends(require_session)) -> Dict:
    """Return the caller's own account, resolved from the session token."""
    member = MEMBERS.get(session_member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    return member


@app.get("/api/profile/{user_id}")
def get_profile(user_id: int, session_member_id: int = Depends(require_session)) -> Dict:
    """Return the full member profile for the requested user_id.

    The session dependency confirms the caller is authenticated. The record is
    then looked up directly from the path user_id.
    """
    member = MEMBERS.get(user_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    return member


@app.get("/api/profile/{user_id}/refunds")
def get_profile_refunds(user_id: int, session_member_id: int = Depends(require_session)) -> Dict:
    """Return the refund credit and active reservation for the requested user_id."""
    member = MEMBERS.get(user_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    return {
        "member_id": member["member_id"],
        "active_reservation": member["active_reservation"],
        "refund_credit_usd": member["refund_credit_usd"],
    }


if __name__ == "__main__":
    # Surface the seeded tokens and their member ids for the local ZAP user setup.
    for label, token in TEST_TOKENS.items():
        print(f"{label}: token={token} -> member_id={SESSIONS[token]}")

    uvicorn.run(app, host="0.0.0.0", port=8000)

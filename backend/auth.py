
import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer

from clerk_backend_api import (
    AuthenticateRequestOptions,
    authenticate_request,
)

load_dotenv()

bearer_scheme = HTTPBearer(auto_error=False)

CLERK_SECRET_KEY = os.environ["CLERK_SECRET_KEY"]

AUTHORIZED_PARTIES = [
    origin.strip()
    for origin in os.environ[
        "CLERK_AUTHORIZED_PARTIES"
    ].split(",")
    if origin.strip()
]


def get_current_user(
    request: Request,
    _credentials=Depends(bearer_scheme),
) -> str:
    state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=CLERK_SECRET_KEY,
            authorized_parties=AUTHORIZED_PARTIES,
            accepts_token=["session_token"],
        ),
    )

    if not state.is_signed_in or not state.payload:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    user_id = state.payload["sub"]

    # Only store identity after Clerk verification.
    # SlowAPI uses this to apply per-user limits.
    request.state.user_id = user_id

    return user_id

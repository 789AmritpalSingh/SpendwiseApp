
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_rate_limit_key(request: Request) -> str:
    """
    Use the verified Clerk user ID when available.

    The ID must come from backend authentication,
    never from an untrusted request header.
    """

    user_id = getattr(
        request.state,
        "user_id",
        None,
    )

    if user_id:
        return f"user:{user_id}"

    # Fallback for endpoints without Clerk identity.
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=get_rate_limit_key,
    storage_uri="memory://",
)

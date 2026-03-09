"""Simple retry/backoff utility used by ML engine workers.

Provides a `retry` decorator that supports exponential backoff with optional
jitter and an injectable `sleep_func` for fast unit testing.
"""
from functools import wraps
import random
import time
from typing import Callable, Any, Tuple


def retry(max_attempts: int = 3,
          exceptions: Tuple[type, ...] = (Exception,),
          backoff_factor: float = 0.5,
          max_backoff: float = 10.0,
          jitter: float = 0.1,
          sleep_func: Callable[[float], None] = time.sleep):
    """Return a decorator that retries the wrapped call on specified
    exceptions using exponential backoff.

    Parameters are intentionally simple and the `sleep_func` can be
    overridden in tests to avoid actual sleeping.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs) -> Any:
            attempt = 1
            while True:
                try:
                    return fn(*args, **kwargs)
                except exceptions:
                    if attempt >= max_attempts:
                        # re-raise the last exception
                        raise
                    # exponential backoff: backoff_factor * 2^(attempt-1)
                    backoff = min(max_backoff, backoff_factor * (2 ** (attempt - 1)))
                    # apply small jitter in range [-jitter, +jitter]
                    backoff = backoff * (1 + jitter * (random.random() * 2 - 1))
                    sleep_func(backoff)
                    attempt += 1

        return wrapper

    return decorator


def retry_call(fn: Callable, *args, max_attempts: int = 3, **kwargs) -> Any:
    """Simple helper to call a function with retries using the default
    `retry` decorator settings. This is a convenience wrapper used in
    small workflows.
    """
    wrapped = retry(max_attempts=max_attempts)(fn)
    return wrapped(*args, **kwargs)

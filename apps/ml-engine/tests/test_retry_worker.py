import pytest

from apps.ml_engine import retry_worker as rw


def test_retry_succeeds_after_retries():
    calls = {"count": 0}

    def sleep(n):
        # record that sleep was called but don't actually delay tests
        calls.setdefault("slept", 0)
        calls["slept"] += 1

    @rw.retry(max_attempts=4, backoff_factor=0.001, sleep_func=sleep)
    def flaky():
        calls["count"] += 1
        if calls["count"] < 3:
            raise ValueError("transient")
        return "ok"

    assert flaky() == "ok"
    assert calls["count"] == 3
    assert calls["slept"] == 2


def test_retry_raises_after_max_attempts():
    calls = {"count": 0}

    def sleep(n):
        calls.setdefault("slept", 0)
        calls["slept"] += 1

    @rw.retry(max_attempts=2, backoff_factor=0.001, sleep_func=sleep)
    def always_fail():
        calls["count"] += 1
        raise RuntimeError("fail")

    with pytest.raises(RuntimeError):
        always_fail()

    assert calls["count"] == 2
    assert calls["slept"] == 1

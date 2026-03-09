import sys, os
import importlib.util
import pytest
from datetime import date

proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(proj_root)

# load broker_flow module directly from file path
spec = importlib.util.spec_from_file_location(
    "broker_flow",
    os.path.join(proj_root, "broker_flow.py"),
)
broker_flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker_flow)


class DummyCursor:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.queries = []

    def execute(self, query, params=None):
        self.queries.append((query, params))
        # no return

    def fetchone(self):
        if self.rows:
            return (self.rows.pop(0),)
        return (0,)

    def fetchall(self):
        return [(r,) for r in (self.rows or [])]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass


class DummyConn:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.cursor_obj = DummyCursor(self.rows.copy())
        self.committed = False

    def cursor(self):
        return DummyCursor(self.rows.copy())

    def commit(self):
        self.committed = True

    def close(self):
        pass


@pytest.fixture
def dummy_conn():
    # create connection with some historical values
    return DummyConn(rows=[100, 120, 80, 110, 90])


def test_compute_consistency(dummy_conn, monkeypatch):
    # force cursor to return count 3
    cur = DummyCursor(rows=[3])
    conn = DummyConn(rows=[3])
    cons = broker_flow.compute_consistency(conn, "BBCA", "PD")
    assert cons == 3 / 7


def test_compute_zscore(dummy_conn):
    # provide history 10,20,30 which has mean 20 stdev 10
    conn = DummyConn(rows=[10, 20, 30])
    z = broker_flow.compute_zscore(conn, "BBCA", "PD", 40)
    assert pytest.approx(z, rel=1e-3) == (40 - 20) / 10


def test_store_entries(dummy_conn):
    # create entries and ensure insert executed
    conn = DummyConn()
    e = broker_flow.BrokerFlowEntry("PD", 500, 200)
    e.consistency_score = 0.5
    e.z_score = 1.2
    broker_flow.store_entries(conn, "BBCA", [e])
    assert conn.committed


if __name__ == "__main__":
    pytest.main([__file__])

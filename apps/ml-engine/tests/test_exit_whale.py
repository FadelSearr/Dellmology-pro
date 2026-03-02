import sys, os, importlib.util
import pytest

proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(proj_root)

# load exit_whale module directly from file path
spec = importlib.util.spec_from_file_location(
    "exit_whale",
    os.path.join(proj_root, "exit_whale.py"),
)
exit_whale = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exit_whale)


class DummyCursor:
    def __init__(self, rows=None):
        # rows will be consumed by fetchall
        self.rows = rows or []
        self.queries = []

    def execute(self, query, params=None):
        self.queries.append((query, params))
        # do nothing else

    def fetchall(self):
        # return each tuple as a row
        return self.rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass


class DummyConn:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.cursor_obj = DummyCursor(self.rows.copy())
        self.committed = False
        self.inserted = []

    def cursor(self):
        return DummyCursor(self.rows.copy())

    def commit(self):
        self.committed = True

    def close(self):
        pass


def test_detect_exit_whales_empty():
    conn = DummyConn(rows=[])
    inserted = exit_whale.detect_exit_whales(conn, threshold=100)
    assert inserted == []
    assert conn.committed


def test_detect_exit_whales_threshold():
    # one row below the threshold should be inserted, one above should be ignored
    rows = [("BBCA", "PD", -150), ("BBCA", "AX", -50)]
    conn = DummyConn(rows=rows)
    inserted = exit_whale.detect_exit_whales(conn, threshold=100)
    assert inserted == [("BBCA", "PD", -150)]
    assert conn.committed


if __name__ == "__main__":
    pytest.main([__file__])

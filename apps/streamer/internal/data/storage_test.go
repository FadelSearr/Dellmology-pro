package data

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestStoreRawTrade_RetrySucceeds(t *testing.T) {
	// create sqlmock DB and assign to package-level db
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer mockDB.Close()
	// replace package db with mock
	db = mockDB

	// Expect first Exec to return error, second Exec to succeed
	mock.ExpectExec("INSERT INTO trades").WillReturnError(sqlmock.ErrCancelled)
	mock.ExpectExec("INSERT INTO trades").WillReturnResult(sqlmock.NewResult(1, 1))

	err = StoreRawTrade("TEST", 123.45, 100, "BUY")
	if err != nil {
		t.Fatalf("expected nil error after retry, got: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestStoreRawTrade_AllAttemptsFail(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer mockDB.Close()
	db = mockDB

	// Make the Exec fail for all attempts (we expect at least 1 attempt)
	// Provide enough expectations to satisfy retries (5 attempts)
	for i := 0; i < 5; i++ {
		mock.ExpectExec("INSERT INTO trades").WillReturnError(sqlmock.ErrCancelled)
	}

	err = StoreRawTrade("FAIL", 1.0, 1, "SELL")
	if err == nil {
		t.Fatalf("expected error after all retries fail, got nil")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

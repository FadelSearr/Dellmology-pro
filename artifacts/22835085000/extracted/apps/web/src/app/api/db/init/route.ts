import { db } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// This endpoint is for development convenience to initialize the DB schema.
export async function GET() {
  try {
    const sqlFilePath = path.join(process.cwd(), "src", "lib", "schema.sql");
    const sql = await fs.readFile(sqlFilePath, "utf-8");

    const client = await db.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }

    console.log("Database schema initialized successfully.");
    return NextResponse.json(
      { message: "Database schema initialized successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    // Check if error is an instance of Error to safely access message property
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { message: "Failed to initialize database schema.", error: errorMessage },
      { status: 500 }
    );
  }
}

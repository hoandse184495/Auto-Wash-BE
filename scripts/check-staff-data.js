import dotenv from "dotenv";
import sql from "mssql";

dotenv.config();

const cfg = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const queries = [
  [
    "users by role",
    "SELECT Role, Status, COUNT(*) AS Count FROM Users GROUP BY Role, Status ORDER BY Role, Status",
  ],
  [
    "staff accounts",
    "SELECT TOP 20 UserID, FullName, Email, Role, Status, BranchID FROM Users WHERE Role IN ('Staff','Manager','Admin') ORDER BY Role, UserID",
  ],
  [
    "today bookings",
    `SELECT
       BG.BookingGroupID, BG.BookingCode, BG.BranchID, BG.BookingDate, BG.StartTime, BG.Status,
       COUNT(BI.BookingItemID) AS Items
     FROM BookingGroups BG
     LEFT JOIN BookingItems BI ON BI.BookingGroupID = BG.BookingGroupID
     WHERE CAST(BG.BookingDate AS date) = CAST(GETDATE() AS date)
     GROUP BY BG.BookingGroupID, BG.BookingCode, BG.BranchID, BG.BookingDate, BG.StartTime, BG.Status
     ORDER BY BG.StartTime`,
  ],
  [
    "latest bookings",
    `SELECT TOP 20
       BG.BookingGroupID, BG.BookingCode, BG.BranchID, BG.BookingDate, BG.StartTime, BG.Status,
       COUNT(BI.BookingItemID) AS Items
     FROM BookingGroups BG
     LEFT JOIN BookingItems BI ON BI.BookingGroupID = BG.BookingGroupID
     GROUP BY BG.BookingGroupID, BG.BookingCode, BG.BranchID, BG.BookingDate, BG.StartTime, BG.Status
     ORDER BY BG.BookingDate DESC, BG.StartTime DESC`,
  ],
];

const pool = await sql.connect(cfg);

for (const [name, query] of queries) {
  const result = await pool.request().query(query);
  console.log(`\n--- ${name} ---`);
  console.table(result.recordset);
}

await pool.close();

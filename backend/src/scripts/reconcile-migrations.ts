import { AppDataSource } from "../config/data-source";

type MigrationRecord = {
  timestamp: number;
  name: string;
  artifactProbeSql: string;
};

const knownMigrations: MigrationRecord[] = [
  {
    timestamp: 1700000000000,
    name: "Init1700000000000",
    artifactProbeSql:
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'admin_users'",
  },
  {
    timestamp: 1700000000001,
    name: "AddPayoutBudget1700000000001",
    artifactProbeSql:
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'payout_releases' AND column_name = 'releaseBudget'",
  },
  {
    timestamp: 1700000000002,
    name: "AddPayerName1700000000002",
    artifactProbeSql:
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'payment_transactions' AND column_name = 'payerName'",
  },
  {
    timestamp: 1700000000003,
    name: "AddInstantWinSettings1700000000003",
    artifactProbeSql:
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'instant_win_settings'",
  },
];

async function ensureMigrationsTable() {
  await AppDataSource.query(
    `CREATE TABLE IF NOT EXISTS migrations (
      id int NOT NULL AUTO_INCREMENT,
      timestamp bigint NOT NULL,
      name varchar(255) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB`
  );
}

async function reconcile() {
  await AppDataSource.initialize();
  await ensureMigrationsTable();

  const existingRows = (await AppDataSource.query(
    "SELECT timestamp, name FROM migrations"
  )) as Array<{ timestamp: string | number; name: string }>;
  const existing = new Set(
    existingRows.map((row) => `${Number(row.timestamp)}:${row.name}`)
  );

  let inserted = 0;
  let skippedMissingArtifacts = 0;
  for (const migration of knownMigrations) {
    const key = `${migration.timestamp}:${migration.name}`;
    if (existing.has(key)) {
      continue;
    }

    const probe = (await AppDataSource.query(
      migration.artifactProbeSql
    )) as Array<{ count: string | number }>;
    const count = Number(probe?.[0]?.count ?? 0);
    if (count <= 0) {
      skippedMissingArtifacts += 1;
      continue;
    }

    await AppDataSource.query(
      "INSERT INTO migrations (timestamp, name) VALUES (?, ?)",
      [migration.timestamp, migration.name]
    );
    inserted += 1;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        reconciled: true,
        inserted,
        skippedMissingArtifacts,
        checked: knownMigrations.length,
      },
      null,
      2
    )
  );
}

reconcile()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

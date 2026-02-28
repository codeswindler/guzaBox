import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPerformanceIndexes1700000000006 implements MigrationInterface {
  name = "AddPerformanceIndexes1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index on payment_transactions for status and createdAt (most common query pattern)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_payment_transactions_status_created ON payment_transactions(status, createdAt DESC)`
    );

    // Index on payment_transactions for createdAt alone (for date range queries)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_payment_transactions_created ON payment_transactions(createdAt DESC)`
    );

    // Index on payment_transactions for phoneNumber (for leaderboard queries)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_payment_transactions_phone ON payment_transactions(phoneNumber)`
    );

    // Index on winners for createdAt (for date range queries)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_winners_created ON winners(createdAt DESC)`
    );

    // Index on payout_releases for createdAt (for listing releases)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_payout_releases_created ON payout_releases(createdAt DESC)`
    );

    // Index on payment_transactions for released flag (for daily collections)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_payment_transactions_released ON payment_transactions(released, status, createdAt)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_transactions_status_created ON payment_transactions`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_transactions_created ON payment_transactions`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_transactions_phone ON payment_transactions`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_winners_created ON winners`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payout_releases_created ON payout_releases`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_transactions_released ON payment_transactions`);
  }
}

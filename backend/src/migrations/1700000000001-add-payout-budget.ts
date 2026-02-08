import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayoutBudget1700000000001 implements MigrationInterface {
  name = "AddPayoutBudget1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payout_releases ADD COLUMN releaseBudget decimal(12,2) NULL"
    );
    await queryRunner.query(
      "ALTER TABLE payout_releases ADD COLUMN totalReleased decimal(12,2) NOT NULL DEFAULT 0"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE payout_releases DROP COLUMN totalReleased");
    await queryRunner.query("ALTER TABLE payout_releases DROP COLUMN releaseBudget");
  }
}

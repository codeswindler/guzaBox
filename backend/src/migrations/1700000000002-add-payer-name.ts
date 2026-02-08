import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayerName1700000000002 implements MigrationInterface {
  name = "AddPayerName1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions ADD COLUMN payerName varchar(255) NULL"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions DROP COLUMN payerName"
    );
  }
}
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayerName1700000000002 implements MigrationInterface {
  name = "AddPayerName1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions ADD payerName varchar(255) NULL"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions DROP COLUMN payerName"
    );
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountReference1700000000004 implements MigrationInterface {
  name = "AddAccountReference1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions ADD COLUMN accountReference varchar(10) NULL"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE payment_transactions DROP COLUMN accountReference"
    );
  }
}

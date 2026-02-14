import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInstantWinSettings1700000000003 implements MigrationInterface {
  name = "AddInstantWinSettings1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE instant_win_settings (
        id int NOT NULL AUTO_INCREMENT,
        enabled tinyint NOT NULL DEFAULT 0,
        maxPercentage decimal(5,2) NOT NULL DEFAULT 50.00,
        baseProbability decimal(6,4) NOT NULL DEFAULT 0.1000,
        minAmount decimal(10,2) NOT NULL DEFAULT 100.00,
        maxAmount decimal(10,2) NOT NULL DEFAULT 1000.00,
        loserMessage varchar(500) NOT NULL DEFAULT 'Almost won. Try again.',
        sendWinnerMessages tinyint NOT NULL DEFAULT 0,
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `INSERT INTO instant_win_settings (enabled, maxPercentage, baseProbability, minAmount, maxAmount, loserMessage, sendWinnerMessages)
       VALUES (0, 50.00, 0.1000, 100.00, 1000.00, 'Almost won. Try again.', 0)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE instant_win_settings");
  }
}

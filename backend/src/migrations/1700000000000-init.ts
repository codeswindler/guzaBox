import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1700000000000 implements MigrationInterface {
  name = "Init1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE admin_users (
        id varchar(36) NOT NULL,
        phone varchar(255) NOT NULL,
        email varchar(255) NULL,
        isActive tinyint NOT NULL DEFAULT 1,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_admin_users_phone (phone),
        UNIQUE INDEX IDX_admin_users_email (email),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `CREATE TABLE otp_codes (
        id varchar(36) NOT NULL,
        codeHash varchar(255) NOT NULL,
        expiresAt datetime(6) NOT NULL,
        used tinyint NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        adminId varchar(36) NULL,
        PRIMARY KEY (id),
        INDEX IDX_otp_codes_admin (adminId),
        CONSTRAINT FK_otp_codes_admin FOREIGN KEY (adminId) REFERENCES admin_users(id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `CREATE TABLE ussd_sessions (
        id varchar(36) NOT NULL,
        sessionId varchar(255) NOT NULL,
        phoneNumber varchar(255) NOT NULL,
        state varchar(255) NOT NULL DEFAULT 'START',
        selectedBox varchar(255) NULL,
        transactionId varchar(36) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `CREATE TABLE payment_transactions (
        id varchar(36) NOT NULL,
        phoneNumber varchar(255) NOT NULL,
        amount decimal(10,2) NOT NULL,
        box varchar(255) NULL,
        sessionId varchar(255) NULL,
        status varchar(255) NOT NULL DEFAULT 'PENDING',
        mpesaReceipt varchar(255) NULL,
        checkoutRequestId varchar(255) NULL,
        resultCode varchar(255) NULL,
        resultDesc varchar(255) NULL,
        released tinyint NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `CREATE TABLE payout_releases (
        id varchar(36) NOT NULL,
        percentage decimal(5,2) NOT NULL,
        minWin decimal(10,2) NOT NULL,
        maxWin decimal(10,2) NOT NULL,
        totalWinners int NOT NULL DEFAULT 0,
        createdBy varchar(255) NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`
    );

    await queryRunner.query(
      `CREATE TABLE winners (
        id varchar(36) NOT NULL,
        amount decimal(10,2) NOT NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        transactionId varchar(36) NULL,
        releaseId varchar(36) NULL,
        PRIMARY KEY (id),
        INDEX IDX_winners_tx (transactionId),
        INDEX IDX_winners_release (releaseId),
        CONSTRAINT FK_winners_tx FOREIGN KEY (transactionId) REFERENCES payment_transactions(id),
        CONSTRAINT FK_winners_release FOREIGN KEY (releaseId) REFERENCES payout_releases(id)
      ) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE winners");
    await queryRunner.query("DROP TABLE payout_releases");
    await queryRunner.query("DROP TABLE payment_transactions");
    await queryRunner.query("DROP TABLE ussd_sessions");
    await queryRunner.query("DROP TABLE otp_codes");
    await queryRunner.query("DROP TABLE admin_users");
  }
}

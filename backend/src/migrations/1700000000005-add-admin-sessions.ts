import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminSessions1700000000005 implements MigrationInterface {
  name = "AddAdminSessions1700000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE admin_sessions (
        id varchar(36) NOT NULL,
        adminId varchar(36) NOT NULL,
        tokenHash varchar(500) NOT NULL,
        deviceInfo text NOT NULL,
        lastActivityAt datetime(6) NOT NULL,
        isActive tinyint NOT NULL DEFAULT 1,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_admin_sessions_admin (adminId),
        INDEX IDX_admin_sessions_token (tokenHash),
        INDEX IDX_admin_sessions_active (isActive),
        CONSTRAINT FK_admin_sessions_admin FOREIGN KEY (adminId) REFERENCES admin_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE admin_sessions`);
  }
}

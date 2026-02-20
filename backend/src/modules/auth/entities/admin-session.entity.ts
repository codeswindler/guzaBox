import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AdminUser } from "./admin-user.entity";

@Entity("admin_sessions")
@Index("IDX_admin_sessions_admin", ["adminId"])
@Index("IDX_admin_sessions_token", ["tokenHash"])
@Index("IDX_admin_sessions_active", ["isActive"])
export class AdminSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  adminId!: string;

  @Column({ type: "varchar", length: 500 })
  tokenHash!: string; // Hashed JWT token

  @Column({ type: "text" })
  deviceInfo!: string; // JSON: { userAgent, ip, deviceFingerprint }

  @Column({ type: "datetime" })
  lastActivityAt!: Date;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: "adminId" })
  admin!: AdminUser;
}

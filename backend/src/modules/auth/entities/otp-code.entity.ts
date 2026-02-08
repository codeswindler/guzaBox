import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AdminUser } from "./admin-user.entity";

@Entity("otp_codes")
export class OtpCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => AdminUser, { eager: true })
  admin!: AdminUser;

  @Column()
  codeHash!: string;

  @Column()
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

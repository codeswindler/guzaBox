import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("admin_users")
export class AdminUser {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  phone!: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  email!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

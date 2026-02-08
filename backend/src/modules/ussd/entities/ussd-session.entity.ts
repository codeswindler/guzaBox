import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("ussd_sessions")
export class UssdSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  sessionId!: string;

  @Column()
  phoneNumber!: string;

  @Column({ default: "START" })
  state!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  selectedBox!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  transactionId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

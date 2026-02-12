import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

@Entity("payment_transactions")
export class PaymentTransaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  phoneNumber!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  box!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  sessionId!: string | null;

  @Column({ default: "PENDING" })
  status!: PaymentStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  mpesaReceipt!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  payerName!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  checkoutRequestId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  resultCode!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  resultDesc!: string | null;

  @Column({ default: false })
  released!: boolean;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  wonAmount!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

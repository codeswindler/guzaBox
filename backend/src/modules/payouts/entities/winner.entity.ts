import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PaymentTransaction } from "../../payments/entities/payment-transaction.entity";
import { PayoutRelease } from "./payout-release.entity";

@Entity("winners")
export class Winner {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => PaymentTransaction, { eager: true })
  transaction!: PaymentTransaction;

  @ManyToOne(() => PayoutRelease, { eager: true })
  release!: PayoutRelease;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { PaymentTransaction } from "../../payments/entities/payment-transaction.entity";
import { Winner } from "../../payouts/entities/winner.entity";

@Entity("players")
export class Player {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  phoneNumber!: string;

  @Column({ nullable: true })
  payerName?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  totalStaked!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  totalWon!: number;

  @Column({ type: "int", default: 0 })
  transactionCount!: number;

  @Column({ type: "int", default: 0 })
  winCount!: number;

  @Column({ type: "decimal", precision: 5, scale: 4, default: 0 })
  winRate!: number;

  @Column({ type: "boolean", default: false })
  hasWonBefore!: boolean;

  @Column({ type: "datetime", nullable: true })
  lastWinAt?: Date;

  @Column({ type: "datetime", nullable: true })
  lastPlayedAt?: Date;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  loyaltyScore!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => PaymentTransaction, "player")
  transactions!: PaymentTransaction[];

  @OneToMany(() => Winner, "player")
  winnings!: Winner[];
}

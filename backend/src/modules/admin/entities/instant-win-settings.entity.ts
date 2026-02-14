import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("instant_win_settings")
export class InstantWinSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ default: false })
  enabled!: boolean;

  @Column("decimal", { precision: 5, scale: 2, default: 50 })
  maxPercentage!: number;

  @Column("decimal", { precision: 6, scale: 4, default: 0.1 })
  baseProbability!: number;

  @Column("decimal", { precision: 10, scale: 2, default: 100 })
  minAmount!: number;

  @Column("decimal", { precision: 10, scale: 2, default: 1000 })
  maxAmount!: number;

  @Column({ type: "varchar", length: 500, default: "Almost won. Try again." })
  loserMessage!: string;

  @Column({ default: false })
  sendWinnerMessages!: boolean;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("payout_releases")
export class PayoutRelease {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("decimal", { precision: 5, scale: 2 })
  percentage!: number;

  @Column("decimal", { precision: 10, scale: 2 })
  minWin!: number;

  @Column("decimal", { precision: 10, scale: 2 })
  maxWin!: number;

  @Column("decimal", { precision: 12, scale: 2, nullable: true })
  releaseBudget!: number | null;

  @Column("decimal", { precision: 12, scale: 2, default: 0 })
  totalReleased!: number;

  @Column({ default: 0 })
  totalWinners!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

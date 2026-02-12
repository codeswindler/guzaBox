-- Add wonAmount column for instant gratification tracking
ALTER TABLE payment_transactions 
ADD COLUMN wonAmount DECIMAL(10,2) NULL;

-- Add index for faster queries on instant wins
CREATE INDEX idx_payment_transactions_won_amount ON payment_transactions(wonAmount);

-- Add index for today's transactions with instant wins
CREATE INDEX idx_payment_transactions_today_wins ON payment_transactions(createdAt, wonAmount) WHERE wonAmount IS NOT NULL;

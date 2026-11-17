DROP INDEX `transactions_from_wallet`;--> statement-breakpoint
DROP INDEX `transactions_to_wallet`;--> statement-breakpoint
CREATE INDEX `transactions_from_wallet_amount` ON `transactions` (`from_wallet_id`,`deleted_at`,`amount`);--> statement-breakpoint
CREATE INDEX `transactions_to_wallet_amount` ON `transactions` (`to_wallet_id`,`deleted_at`,`amount`);
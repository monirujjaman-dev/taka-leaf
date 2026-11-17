CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`lender` text,
	`wallet_id` text NOT NULL,
	`pay_from_wallet_id` text NOT NULL,
	`principal` integer NOT NULL,
	`rate_points` integer NOT NULL,
	`months` integer NOT NULL,
	`emi` integer NOT NULL,
	`first_due_date` text NOT NULL,
	`paid_before` integer NOT NULL,
	`auto_record` integer NOT NULL,
	`closed_on` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `loan_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `loan_emi` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `loan_part` text;--> statement-breakpoint
CREATE INDEX `transactions_loan` ON `transactions` (`loan_id`);
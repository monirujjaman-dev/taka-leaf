CREATE TABLE `savings` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`provider` text,
	`wallet_id` text,
	`pay_from_wallet_id` text NOT NULL,
	`amount` integer NOT NULL,
	`rate_points` integer NOT NULL,
	`months` integer NOT NULL,
	`every_months` integer NOT NULL,
	`start_date` text NOT NULL,
	`tax_points` integer NOT NULL,
	`charges_per_year` integer NOT NULL,
	`maturity_amount` integer,
	`cover` integer,
	`policy` text,
	`policy_number` text,
	`insured` text,
	`nominee` text,
	`bond_numbers` text,
	`paid_before` integer NOT NULL,
	`auto_record` integer NOT NULL,
	`remind` integer NOT NULL,
	`renew` integer NOT NULL,
	`missed` text,
	`seq_base` integer NOT NULL,
	`closed_on` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `saving_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `saving_seq` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `saving_part` text;--> statement-breakpoint
CREATE INDEX `transactions_saving` ON `transactions` (`saving_id`);
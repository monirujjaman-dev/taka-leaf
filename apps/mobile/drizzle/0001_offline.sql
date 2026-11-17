CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`amount` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`icon` text,
	`color` text,
	`archived` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mutation_id` text NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_mutation_id_unique` ON `outbox` (`mutation_id`);--> statement-breakpoint
CREATE INDEX `outbox_row` ON `outbox` (`table_name`,`row_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`from_wallet_id` text,
	`to_wallet_id` text,
	`category_id` text,
	`note` text,
	`frequency` text NOT NULL,
	`interval` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`occurrences` integer NOT NULL,
	`next_date` text NOT NULL,
	`auto_record` integer NOT NULL,
	`paused` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `sync_rejects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`reason` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`from_wallet_id` text,
	`to_wallet_id` text,
	`category_id` text,
	`person_id` text,
	`fee_of_id` text,
	`recurring_rule_id` text,
	`recurring_date` text,
	`occurred_at` text NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `transactions_occurred_at` ON `transactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `transactions_from_wallet` ON `transactions` (`from_wallet_id`);--> statement-breakpoint
CREATE INDEX `transactions_to_wallet` ON `transactions` (`to_wallet_id`);--> statement-breakpoint
CREATE INDEX `transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_fee_of` ON `transactions` (`fee_of_id`);--> statement-breakpoint
CREATE INDEX `transactions_person` ON `transactions` (`person_id`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`opening_balance` integer NOT NULL,
	`credit_limit` integer,
	`person_id` text,
	`icon` text,
	`color` text,
	`archived` integer NOT NULL,
	`excluded_from_total` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
DROP TABLE `health_checks`;--> statement-breakpoint
DROP TABLE `probe_notes`;
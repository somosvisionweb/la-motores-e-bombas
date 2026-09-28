CREATE TABLE `store_order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`type` text NOT NULL,
	`to_status` text,
	`message` text,
	`is_public` integer DEFAULT true NOT NULL,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `store_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_store_events_order` ON `store_order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `store_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`token` text NOT NULL,
	`sale_id` integer NOT NULL,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`fulfillment` text NOT NULL,
	`payment_method` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_phone` text NOT NULL,
	`buyer_email` text,
	`delivery_address` text,
	`notes` text,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`pix_payload` text,
	`search_text` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_ip` text,
	`confirmed_at` integer,
	`ready_at` integer,
	`completed_at` integer,
	`canceled_at` integer,
	`cancel_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_orders_number_unique` ON `store_orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_store_orders_token` ON `store_orders` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_store_orders_sale` ON `store_orders` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_store_orders_status` ON `store_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_store_orders_created` ON `store_orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_store_orders_ip` ON `store_orders` (`created_ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_store_orders_phone` ON `store_orders` (`buyer_phone`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`pix_key` text,
	`pix_key_type` text,
	`delivery_enabled` integer DEFAULT false NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`free_delivery_min_cents` integer,
	`delivery_note` text,
	`pickup_note` text,
	`min_order_cents` integer DEFAULT 0 NOT NULL,
	`hold_hours` integer DEFAULT 24 NOT NULL,
	`policy_text` text,
	`updated_by` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `products` ADD `sell_online` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `store_description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `demo_price_cents` integer;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `is_fee` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `channel` text DEFAULT 'BALCAO' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sales_channel` ON `sales` (`channel`);--> statement-breakpoint
UPDATE `roles` SET `permissions` = json_insert(`permissions`, '$[#]', 'store.view') WHERE `key` = 'seller' AND NOT EXISTS (SELECT 1 FROM json_each(`roles`.`permissions`) WHERE `value` = 'store.view');--> statement-breakpoint
UPDATE `roles` SET `permissions` = json_insert(`permissions`, '$[#]', 'store.manage') WHERE `key` = 'seller' AND NOT EXISTS (SELECT 1 FROM json_each(`roles`.`permissions`) WHERE `value` = 'store.manage');

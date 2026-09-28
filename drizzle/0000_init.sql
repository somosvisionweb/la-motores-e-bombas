CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`user_name` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`summary` text,
	`data` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cnpj` text,
	`email` text,
	`whatsapp` text,
	`phone` text,
	`address` text,
	`city` text,
	`state` text,
	`zip` text,
	`instagram` text,
	`hours` text NOT NULL,
	`payment_methods` text NOT NULL,
	`logo_file_id` integer,
	`seo_title` text,
	`seo_description` text,
	`public_base_url` text,
	`timezone` text DEFAULT 'America/Recife' NOT NULL,
	`whatsapp_templates` text NOT NULL,
	`updated_by` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`logo_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`whatsapp` text,
	`document` text,
	`email` text,
	`address` text,
	`notes` text,
	`search_text` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_customers_name` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_customers_created` ON `customers` (`created_at`);--> statement-breakpoint
CREATE TABLE `document_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`type` text NOT NULL,
	`ref_id` integer NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_access_at` integer,
	`access_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_links_token` ON `document_links` (`token`);--> statement-breakpoint
CREATE INDEX `idx_document_links_ref` ON `document_links` (`type`,`ref_id`);--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_goods` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_name_unique` ON `expense_categories` (`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`supplier` text,
	`category_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_method` text,
	`notes` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "expenses_amount_positive" CHECK("expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`date`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`category_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`data` blob NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `guarantee_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`warranty_months` integer NOT NULL,
	`content` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guarantee_terms_version_unique` ON `guarantee_terms` (`version`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`ip` text,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_user` ON `login_attempts` (`username`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_login_attempts_ip` ON `login_attempts` (`ip`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`notification_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`notification_id`, `user_id`),
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`permission` text,
	`created_by` integer,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_created` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer,
	`sale_id` integer,
	`customer_id` integer,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`paid_date` text NOT NULL,
	`status` text DEFAULT 'PAID' NOT NULL,
	`voided_at` integer,
	`void_reason` text,
	`voided_by` integer,
	`notes` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `service_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payments_amount_positive" CHECK("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_payments_date` ON `payments` (`paid_date`);--> statement-breakpoint
CREATE INDEX `idx_payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_sale` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_customer` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_method` ON `payments` (`method`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`category` text DEFAULT 'Componentes' NOT NULL,
	`sale_price_cents` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'un' NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`show_on_site` integer DEFAULT true NOT NULL,
	`icon_key` text,
	`image_file_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`image_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_prices_nonneg" CHECK("products"."sale_price_cents" >= 0 AND "products"."cost_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_name_unique` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`format` text NOT NULL,
	`params` text,
	`summary` text,
	`generated_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_reports_created` ON `reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_key_unique` ON `roles` (`key`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sale_items_quantity_positive" CHECK("sale_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_sale_items_sale` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_sale_items_product` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`customer_id` integer,
	`sale_date` text NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`notes` text,
	`canceled_at` integer,
	`cancel_reason` text,
	`search_text` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_number_unique` ON `sales` (`number`);--> statement-breakpoint
CREATE INDEX `idx_sales_date` ON `sales` (`sale_date`);--> statement-breakpoint
CREATE INDEX `idx_sales_customer` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `service_order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`message` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `service_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order` ON `service_order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`kind` text NOT NULL,
	`service_id` integer,
	`product_id` integer,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `service_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_items_quantity_positive" CHECK("service_order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `service_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_product` ON `service_order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`status` text DEFAULT 'AGUARDANDO_AVALIACAO' NOT NULL,
	`equipment` text NOT NULL,
	`brand` text,
	`model` text,
	`problem_description` text,
	`diagnosis` text,
	`service_description` text,
	`entry_date` text NOT NULL,
	`expected_delivery_date` text,
	`delivered_date` text,
	`completed_date` text,
	`next_service_date` text,
	`technician_id` integer,
	`payment_method` text,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`parts_total_cents` integer DEFAULT 0 NOT NULL,
	`labor_total_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`guarantee_terms_id` integer,
	`canceled_at` integer,
	`cancel_reason` text,
	`search_text` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`guarantee_terms_id`) REFERENCES `guarantee_terms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_money_nonneg" CHECK("service_orders"."discount_cents" >= 0 AND "service_orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_orders_number_unique` ON `service_orders` (`number`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer` ON `service_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `service_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_entry_date` ON `service_orders` (`entry_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_completed` ON `service_orders` (`completed_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_delivered` ON `service_orders` (`delivered_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_expected` ON `service_orders` (`expected_delivery_date`);--> statement-breakpoint
CREATE INDEX `idx_orders_technician` ON `service_orders` (`technician_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Geral' NOT NULL,
	`description` text,
	`default_price_cents` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`show_on_site` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_name_unique` ON `services` (`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `site_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` integer NOT NULL,
	`slot` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_site_images_slot` ON `site_images` (`slot`,`sort_order`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_type` text,
	`ref_id` integer,
	`note` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_stock_product` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_ref` ON `stock_movements` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role_id` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`password_changed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role_id`);
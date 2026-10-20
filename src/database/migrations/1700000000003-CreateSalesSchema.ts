import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sales, sale items and the transactional outbox.
 */
export class CreateSalesSchema1700000000003 implements MigrationInterface {
  name = 'CreateSalesSchema1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchant_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "total_amount" numeric(10,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "payment_status" varchar NOT NULL DEFAULT 'PENDING',
        "payment_reference" varchar,
        "idempotency_key" varchar NOT NULL,
        "payment_method" varchar NOT NULL DEFAULT 'MOCK',
        "notes" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sales_store_idempotency" UNIQUE ("store_id", "idempotency_key"),
        CONSTRAINT "fk_sales_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sales_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sales_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_sales_total" CHECK ("total_amount" >= 0),
        CONSTRAINT "chk_sales_status" CHECK ("status" IN ('PENDING','COMPLETED','FAILED','CANCELLED')),
        CONSTRAINT "chk_sales_payment_status" CHECK ("payment_status" IN ('PENDING','SUCCESS','FAILED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_merchant" ON "sales" ("merchant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_store" ON "sales" ("store_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_user" ON "sales" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_created_at" ON "sales" ("created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "product_name" varchar NOT NULL,
        "sku" varchar NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price" numeric(10,2) NOT NULL,
        "line_total" numeric(10,2) NOT NULL,
        CONSTRAINT "fk_sale_items_sale" FOREIGN KEY ("sale_id")
          REFERENCES "sales"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sale_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_sale_items_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "chk_sale_items_line_total" CHECK ("line_total" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_sale" ON "sale_items" ("sale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_product" ON "sale_items" ("product_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregate_id" uuid NOT NULL,
        "merchant_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "user_id" uuid,
        "event_type" varchar NOT NULL,
        "payload" jsonb,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" varchar,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_outbox_aggregate_event" UNIQUE ("aggregate_id", "event_type"),
        CONSTRAINT "fk_outbox_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_outbox_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_outbox_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_outbox_status" CHECK ("status" IN ('PENDING','PROCESSING','PROCESSED','FAILED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_outbox_status" ON "outbox_events" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catalog + store level inventory schema.
 */
export class CreateCatalogAndInventorySchema1700000000002 implements MigrationInterface {
  name = 'CreateCatalogAndInventorySchema1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchant_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "sku" varchar NOT NULL,
        "description" varchar,
        "price" numeric(10,2) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_products_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_products_merchant_sku" UNIQUE ("merchant_id", "sku"),
        CONSTRAINT "chk_products_price" CHECK ("price" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_merchant" ON "products" ("merchant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "store_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "version" integer NOT NULL DEFAULT 1,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_inventories_store_product" UNIQUE ("store_id", "product_id"),
        CONSTRAINT "fk_inventories_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_inventories_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_inventories_quantity" CHECK ("quantity" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventories_store" ON "inventories" ("store_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventories_product" ON "inventories" ("product_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
  }
}

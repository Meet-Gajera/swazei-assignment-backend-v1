import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenancy schema: merchants (the tenant), stores and users.
 */
export class CreateTenancySchema1700000000001 implements MigrationInterface {
  name = 'CreateTenancySchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_merchants_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchant_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "address" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_stores_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_stores_merchant" ON "stores" ("merchant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchant_id" uuid NOT NULL,
        "store_id" uuid,
        "email" varchar NOT NULL,
        "password" varchar NOT NULL,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'CASHIER',
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "fk_users_merchant" FOREIGN KEY ("merchant_id")
          REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_users_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_users_role" CHECK ("role" IN ('MERCHANT_ADMIN','STORE_MANAGER','CASHIER'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_merchant" ON "users" ("merchant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_store" ON "users" ("store_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchants"`);
  }
}

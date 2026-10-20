import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AppException, ErrorCode } from '../../common/errors/app.exception';
import { PaymentStatus, SaleStatus, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { Inventory, Sale, SaleItem } from '../../database/entities';
import { CACHE_SERVICE, CacheService } from '../cache/cache.module';
import { InventoryService } from '../inventory/inventory.service';
import { OutboxService } from '../queue/outbox.service';
import { PaymentsService } from '../payments/payments.service';
import { ProductsRepository } from '../products/products.repository';
import { StoresService } from '../stores/stores.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { SalesRepository } from './sales.repository';

export const SALE_CREATED_EVENT = 'SALE_CREATED';
export const SALE_FAILED_EVENT = 'SALE_FAILED';

const PAYMENT_TIMEOUT_MS = 5000;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly storesService: StoresService,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  /**
   * Creates a sale.
   *
   * Guarantees implemented here:
   *  1. Prices come from the server side catalogue - the client never sends a
   *     price, it only sends product ids and quantities.
   *  2. The total is calculated on the server.
   *  3. Inventory is decremented with a guarded UPDATE
   *     (`... WHERE quantity >= :qty`) inside the same transaction, so two
   *     concurrent POS terminals can never oversell the same stock.
   *  4. The whole thing (sale + items + inventory + outbox event) is committed
   *     in a single transaction - it either fully happens or not at all.
   *  5. `Idempotency-Key` makes a retried POS request return the original
   *     sale instead of creating a second one.
   */
  async create(
    dto: CreateSaleDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
  ): Promise<SaleResponseDto> {
    const storeId = await this.resolveStoreId(dto.storeId, actor);
    const key = idempotencyKey?.trim();

    if (!key) {
      throw new AppException(
        400,
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        'An Idempotency-Key header is required to create a sale',
      );
    }

    // Fast path: an already processed request returns the original sale.
    const existing = await this.salesRepository.findByIdempotencyKey(
      storeId,
      key,
    );
    if (existing) {
      this.logger.log(
        `Idempotent replay for key=${key} (sale=${existing.id}) store=${storeId}`,
      );
      return this.toResponse(existing, true);
    }

    const result = await this.runTransactionWithIdempotencyRaceHandling(
      dto,
      actor,
      storeId,
      key,
    );

    await this.invalidateCaches(storeId);

    if (result.replayed) {
      return this.toResponse(result.sale, true);
    }

    if (result.paymentFailed) {
      // The failed sale is persisted (audit trail) but the API reports the
      // payment failure to the caller.
      throw new AppException(
        402,
        ErrorCode.PAYMENT_FAILED,
        'Payment was declined by the payment provider',
        {
          saleId: result.sale.id,
          paymentReference: result.sale.paymentReference,
          status: result.sale.status,
        },
      );
    }

    return this.toResponse(result.sale, false);
  }

  /**
   * Runs the sale transaction and gracefully handles the race where two
   * identical requests are processed at the same time. The database unique
   * index on (store_id, idempotency_key) is the last line of defence: the
   * loser of the race gets a 23505 and simply returns the winner's sale.
   */
  private async runTransactionWithIdempotencyRaceHandling(
    dto: CreateSaleDto,
    actor: AuthenticatedUser,
    storeId: string,
    key: string,
  ): Promise<{ sale: Sale; replayed: boolean; paymentFailed: boolean }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Re-check inside the transaction: two identical requests may race.
        const raced = await this.salesRepository.findByIdempotencyKey(
          storeId,
          key,
          manager,
        );
        if (raced) {
          return { sale: raced, replayed: true, paymentFailed: false };
        }

        const sale = await this.processSale(dto, actor, storeId, key, manager);
        return {
          sale,
          replayed: false,
          paymentFailed: sale.paymentStatus === PaymentStatus.FAILED,
        };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const winner = await this.salesRepository.findByIdempotencyKey(
          storeId,
          key,
        );
        if (winner) {
          this.logger.log(
            `Idempotency race resolved for key=${key} (sale=${winner.id})`,
          );
          return { sale: winner, replayed: true, paymentFailed: false };
        }
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };
      return driverError?.code === '23505';
    }
    return false;
  }

  /**
   * The transactional core of the sale flow.
   */
  private async processSale(
    dto: CreateSaleDto,
    actor: AuthenticatedUser,
    storeId: string,
    idempotencyKey: string,
    manager: EntityManager,
  ): Promise<Sale> {
    // 1. Merge duplicate product lines and load the catalogue (tenant scoped).
    const requested = new Map<string, number>();
    for (const item of dto.items) {
      requested.set(
        item.productId,
        (requested.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = Array.from(requested.keys()).sort();
    const products = await this.productsRepository.findByIdsAndMerchant(
      productIds,
      actor.merchantId,
    );

    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !found.has(id));
      throw AppException.badRequest(
        'One or more products do not exist or do not belong to your tenant',
        { productIds: missing },
      );
    }

    const productById = new Map(products.map((p) => [p.id, p]));

    // 2. Lock the inventory rows (deterministic order => no deadlocks).
    const inventories = await this.lockInventory(storeId, productIds, manager);

    // 3. Validate availability.
    for (const productId of productIds) {
      const inventory = inventories.get(productId);
      const required = requested.get(productId)!;
      const available = inventory?.quantity ?? 0;

      if (available < required) {
        throw new AppException(
          409,
          ErrorCode.INSUFFICIENT_INVENTORY,
          `Insufficient inventory for product ${productById.get(productId)!.name}`,
          {
            productId,
            sku: productById.get(productId)!.sku,
            required,
            available,
          },
        );
      }
    }

    // 4. Server side pricing + total.
    let totalAmount = 0;
    const lines: {
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[] = [];

    for (const productId of productIds) {
      const product = productById.get(productId)!;
      const quantity = requested.get(productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;

      totalAmount += lineTotal;
      lines.push({
        productId,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice,
        lineTotal,
      });
    }
    totalAmount = Math.round(totalAmount * 100) / 100;

    // 5. Create the sale header.
    const sale = this.salesRepository.create(
      {
        merchantId: actor.merchantId,
        storeId,
        userId: actor.userId,
        totalAmount,
        status: SaleStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        idempotencyKey,
        paymentMethod: dto.paymentMethod ?? 'MOCK',
        notes: dto.notes ?? null,
      },
      manager,
    );

    const savedSale = await this.salesRepository.save(sale, manager);

    // 6. Process the payment through the provider abstraction.
    const payment = await this.chargeWithTimeout({
      amount: totalAmount,
      reference: savedSale.id,
      metadata: {
        saleId: savedSale.id,
        storeId,
        merchantId: actor.merchantId,
        paymentToken: dto.paymentToken,
        forceOutcome: dto.paymentToken?.startsWith('force_')
          ? dto.paymentToken.replace('force_', '').toUpperCase()
          : undefined,
      },
    });

    savedSale.paymentReference = payment.transactionId;

    if (payment.outcome === 'SUCCESS') {
      savedSale.status = SaleStatus.COMPLETED;
      savedSale.paymentStatus = PaymentStatus.SUCCESS;
    } else {
      savedSale.status = SaleStatus.FAILED;
      savedSale.paymentStatus = PaymentStatus.FAILED;
    }

    // 7. Persist the (immutable) sale lines.
    const items = lines.map((line) =>
      manager.getRepository(SaleItem).create({
        saleId: savedSale.id,
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      }),
    );
    await this.salesRepository.saveItems(items, manager);

    // 8. Decrement the stock - only when the payment succeeded.
    if (payment.outcome === 'SUCCESS') {
      for (const line of lines) {
        const affected = await this.decrementStock(
          storeId,
          line.productId,
          line.quantity,
          manager,
        );
        if (affected === 0) {
          // Should be unreachable (the rows are locked), but if it ever
          // happens we abort the whole transaction.
          throw new AppException(
            409,
            ErrorCode.INSUFFICIENT_INVENTORY,
            `Inventory changed while processing the sale for product ${line.sku}`,
            { productId: line.productId, required: line.quantity },
          );
        }
      }

      // 9. Transactional outbox: the event is committed with the sale.
      await this.outboxService.record(
        {
          aggregateId: savedSale.id,
          merchantId: actor.merchantId,
          storeId,
          userId: actor.userId,
          eventType: SALE_CREATED_EVENT,
          payload: {
            saleId: savedSale.id,
            totalAmount,
            itemCount: lines.length,
            userId: actor.userId,
          },
        },
        manager,
      );
    } else {
      await this.outboxService.record(
        {
          aggregateId: savedSale.id,
          merchantId: actor.merchantId,
          storeId,
          userId: actor.userId,
          eventType: SALE_FAILED_EVENT,
          payload: {
            saleId: savedSale.id,
            totalAmount,
            reason: payment.message,
          },
        },
        manager,
      );
    }

    const finalSale = await this.salesRepository.save(savedSale, manager);
    finalSale.items = items;
    return finalSale;
  }

  /**
   * Locks the inventory rows of a store for the given products.
   * `SELECT ... FOR UPDATE` serialises concurrent sales on the same stock.
   */
  private async lockInventory(
    storeId: string,
    productIds: string[],
    manager: EntityManager,
  ): Promise<Map<string, Inventory>> {
    if (productIds.length === 0) return new Map();

    const rows = await manager
      .getRepository(Inventory)
      .createQueryBuilder('inventory')
      .setLock('pessimistic_write')
      .where('inventory.storeId = :storeId', { storeId })
      .andWhere('inventory.productId IN (:...productIds)', { productIds })
      .getMany();

    return new Map(rows.map((row) => [row.productId, row]));
  }

  private async decrementStock(
    storeId: string,
    productId: string,
    quantity: number,
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .getRepository(Inventory)
      .createQueryBuilder()
      .update(Inventory)
      .set({ quantity: () => `quantity - ${quantity}` })
      .where('store_id = :storeId', { storeId })
      .andWhere('product_id = :productId', { productId })
      .andWhere('quantity >= :quantity', { quantity })
      .execute();

    return result.affected ?? 0;
  }

  private async chargeWithTimeout(request: {
    amount: number;
    reference: string;
    metadata: Record<string, unknown>;
  }) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Payment provider timed out')),
        PAYMENT_TIMEOUT_MS,
      ),
    );
    return Promise.race([this.paymentsService.charge(request), timeout]);
  }

  private async resolveStoreId(
    requestedStoreId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<string> {
    const storeId = requestedStoreId ?? actor.storeId;
    if (!storeId) {
      throw AppException.badRequest(
        'storeId is required for users that are not bound to a store',
      );
    }

    if (actor.role === UserRole.MERCHANT_ADMIN) {
      const belongs = await this.storesService.belongsToMerchant(
        storeId,
        actor.merchantId,
      );
      if (!belongs) {
        throw AppException.forbidden(
          'Store does not belong to your tenant',
          ErrorCode.CROSS_TENANT_ACCESS,
        );
      }
      return storeId;
    }

    // Store managers and cashiers may only sell in their own store.
    if (storeId !== actor.storeId) {
      throw AppException.forbidden(
        'You are only allowed to sell in your own store',
        ErrorCode.CROSS_TENANT_ACCESS,
      );
    }
    await this.storesService.findOne(storeId, actor);
    return storeId;
  }

  async list(
    dto: ListSalesDto,
    actor: AuthenticatedUser,
  ): Promise<{
    items: SaleResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const storeId =
      dto.storeId ??
      (actor.role === UserRole.MERCHANT_ADMIN ? undefined : actor.storeId);

    if (storeId) {
      await this.storesService.findOne(storeId, actor);
    }

    const result = await this.salesRepository.findMany({
      merchantId: actor.merchantId,
      storeId: storeId ?? undefined,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      userId: dto.userId,
      page,
      limit,
    });

    return {
      items: result.items.map((sale) => this.toResponse(sale, false)),
      total: result.total,
      page,
      limit,
    };
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SaleResponseDto> {
    const sale = await this.salesRepository.findByIdAndMerchant(
      id,
      actor.merchantId,
    );
    if (!sale) {
      throw AppException.notFound('Sale');
    }
    if (
      actor.role !== UserRole.MERCHANT_ADMIN &&
      sale.storeId !== actor.storeId
    ) {
      throw AppException.forbidden(
        'Sale belongs to a different store',
        ErrorCode.CROSS_TENANT_ACCESS,
      );
    }
    return this.toResponse(sale, false);
  }

  async summary(
    storeId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<{ storeId: string; totalSales: number; totalAmount: number }> {
    const resolved = await this.resolveStoreId(storeId, actor);
    const summary = await this.salesRepository.summaryByStore(resolved);
    return { storeId: resolved, ...summary };
  }

  private async invalidateCaches(storeId: string): Promise<void> {
    await this.inventoryService.invalidateStoreCache(storeId);
  }

  private toResponse(sale: Sale, replayed: boolean): SaleResponseDto {
    return {
      id: sale.id,
      merchantId: sale.merchantId,
      storeId: sale.storeId,
      userId: sale.userId,
      totalAmount: Number(sale.totalAmount),
      status: sale.status as SaleStatus,
      paymentStatus: sale.paymentStatus as PaymentStatus,
      paymentReference: sale.paymentReference,
      idempotencyKey: sale.idempotencyKey,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes,
      items: (sale.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      replayed,
    };
  }
}

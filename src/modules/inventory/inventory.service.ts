import { Inject, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app.exception';
import { UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { Inventory } from '../../database/entities';
import { CACHE_SERVICE, CacheService } from '../cache/cache.module';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ListInventoryDto } from './dto/list-inventory.dto';
import { InventoryRepository } from './inventory.repository';

export const INVENTORY_CACHE_TTL_SECONDS = 30;

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  /**
   * Resolves the store the request is allowed to operate on and asserts that
   * the store belongs to the caller's merchant.
   */
  async resolveStoreId(
    requestedStoreId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<string> {
    const storeId = requestedStoreId ?? actor.storeId;
    if (!storeId) {
      throw AppException.badRequest(
        'storeId is required for users that are not bound to a store',
      );
    }
    if (actor.role !== UserRole.MERCHANT_ADMIN && storeId !== actor.storeId) {
      throw AppException.forbidden(
        'You are only allowed to access your own store',
        ErrorCode.CROSS_TENANT_ACCESS,
      );
    }
    await this.storesService.findOne(storeId, actor); // throws on cross-tenant
    return storeId;
  }

  async list(
    dto: ListInventoryDto,
    actor: AuthenticatedUser,
  ): Promise<{
    items: Inventory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const storeId = await this.resolveStoreId(dto.storeId, actor);
    const cacheKey = `inventory:${storeId}:${dto.inStockOnly ? 'instock' : 'all'}`;

    const cached = await this.cache.get<Inventory[]>(cacheKey);
    if (cached) {
      return {
        items: cached,
        total: cached.length,
        page: dto.page ?? 1,
        limit: dto.limit ?? 50,
      };
    }

    const all = await this.inventoryRepository.findByStoreWithProduct(storeId);
    const filtered = dto.inStockOnly
      ? all.filter((item) => item.quantity > 0)
      : all;

    await this.cache.set(cacheKey, filtered, INVENTORY_CACHE_TTL_SECONDS);

    return {
      items: filtered,
      total: filtered.length,
      page: dto.page ?? 1,
      limit: dto.limit ?? 50,
    };
  }

  async findByProduct(
    productId: string,
    storeId: string,
    actor: AuthenticatedUser,
  ): Promise<Inventory> {
    const resolvedStoreId = await this.resolveStoreId(storeId, actor);
    // Products are merchant scoped: verifies the product belongs to the tenant.
    await this.productsService.findOne(productId, actor);

    const inventory = await this.inventoryRepository.findByStoreAndProduct(
      resolvedStoreId,
      productId,
    );
    if (!inventory) {
      throw AppException.notFound('Inventory record');
    }
    return inventory;
  }

  async adjust(
    dto: AdjustInventoryDto,
    storeId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<Inventory> {
    const resolvedStoreId = await this.resolveStoreId(storeId, actor);
    const product = await this.productsService.findOne(dto.productId, actor);

    let inventory = await this.inventoryRepository.findByStoreAndProduct(
      resolvedStoreId,
      product.id,
    );

    if (!inventory) {
      inventory = this.inventoryRepository.create({
        storeId: resolvedStoreId,
        productId: product.id,
        quantity: 0,
      });
    }

    inventory.quantity = dto.quantity;
    const saved = await this.inventoryRepository.save(inventory);
    await this.invalidateStoreCache(resolvedStoreId);
    return saved;
  }

  async remove(
    productId: string,
    storeId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const resolvedStoreId = await this.resolveStoreId(storeId, actor);
    const inventory = await this.inventoryRepository.findByStoreAndProduct(
      resolvedStoreId,
      productId,
    );
    if (!inventory) {
      throw AppException.notFound('Inventory record');
    }
    inventory.quantity = 0;
    await this.inventoryRepository.save(inventory);
    await this.invalidateStoreCache(resolvedStoreId);
  }

  async invalidateStoreCache(storeId: string): Promise<void> {
    await this.cache.delByPattern(`inventory:${storeId}:*`);
  }
}

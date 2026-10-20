import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Inventory } from '../../database/entities';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectRepository(Inventory)
    private readonly repository: Repository<Inventory>,
  ) {}

  create(data: Partial<Inventory>): Inventory {
    return this.repository.create(data);
  }

  save(inventory: Inventory, manager?: EntityManager): Promise<Inventory> {
    return manager
      ? manager.getRepository(Inventory).save(inventory)
      : this.repository.save(inventory);
  }

  findByStoreAndProduct(
    storeId: string,
    productId: string,
    manager?: EntityManager,
  ): Promise<Inventory | null> {
    const repo = manager ? manager.getRepository(Inventory) : this.repository;
    return repo.findOne({ where: { storeId, productId } });
  }

  findByStore(storeId: string): Promise<Inventory[]> {
    return this.repository.find({ where: { storeId } });
  }

  findByStoreWithProduct(
    storeId: string,
  ): Promise<(Inventory & { product?: unknown })[]> {
    return this.repository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.product', 'product')
      .where('inventory.storeId = :storeId', { storeId })
      .orderBy('product.name', 'ASC')
      .getMany() as unknown as Promise<(Inventory & { product?: unknown })[]>;
  }

  /**
   * Atomically decrements the stock of a product.
   *
   * The `UPDATE ... WHERE quantity >= :quantity` form guarantees that the
   * write only happens when enough stock exists, and that the row lock is
   * taken by the database (no lost updates, no overselling).
   *
   * @returns the number of affected rows (0 => insufficient inventory)
   */
  async decrementStock(
    storeId: string,
    productId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(Inventory) : this.repository;
    const result = await repo
      .createQueryBuilder()
      .update(Inventory)
      .set({ quantity: () => `quantity - ${quantity}` })
      .where('store_id = :storeId', { storeId })
      .andWhere('product_id = :productId', { productId })
      .andWhere('quantity >= :quantity', { quantity })
      .execute();

    return result.affected ?? 0;
  }

  async incrementStock(
    storeId: string,
    productId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Inventory) : this.repository;
    await repo
      .createQueryBuilder()
      .update(Inventory)
      .set({ quantity: () => `quantity + ${quantity}` })
      .where('store_id = :storeId', { storeId })
      .andWhere('product_id = :productId', { productId })
      .execute();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Sale, SaleItem } from '../../database/entities';

export interface SaleFilter {
  merchantId: string;
  storeId?: string;
  status?: string;
  paymentStatus?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesRepository {
  constructor(
    @InjectRepository(Sale)
    private readonly repository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepository: Repository<SaleItem>,
  ) {}

  create(data: Partial<Sale>, manager?: EntityManager): Sale {
    const repo = manager ? manager.getRepository(Sale) : this.repository;
    return repo.create(data);
  }

  save(sale: Sale, manager?: EntityManager): Promise<Sale> {
    const repo = manager ? manager.getRepository(Sale) : this.repository;
    return repo.save(sale);
  }

  saveItems(items: SaleItem[], manager?: EntityManager): Promise<SaleItem[]> {
    const repo = manager
      ? manager.getRepository(SaleItem)
      : this.itemRepository;
    return repo.save(items);
  }

  findById(id: string): Promise<Sale | null> {
    return this.repository.findOne({ where: { id }, relations: ['items'] });
  }

  findByIdAndMerchant(id: string, merchantId: string): Promise<Sale | null> {
    return this.repository.findOne({
      where: { id, merchantId },
      relations: ['items'],
    });
  }

  /**
   * Idempotency lookup. The unique index is (store_id, idempotency_key) so a
   * duplicate POS retry on the same terminal returns the original sale.
   */
  findByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
    manager?: EntityManager,
  ): Promise<Sale | null> {
    const repo = manager ? manager.getRepository(Sale) : this.repository;
    return repo.findOne({
      where: { storeId, idempotencyKey },
      relations: ['items'],
    });
  }

  async findMany(filter: SaleFilter): Promise<{
    items: Sale[];
    total: number;
  }> {
    const qb = this.repository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .where('sale.merchantId = :merchantId', {
        merchantId: filter.merchantId,
      });

    if (filter.storeId) {
      qb.andWhere('sale.storeId = :storeId', { storeId: filter.storeId });
    }
    if (filter.status) {
      qb.andWhere('sale.status = :status', { status: filter.status });
    }
    if (filter.paymentStatus) {
      qb.andWhere('sale.paymentStatus = :paymentStatus', {
        paymentStatus: filter.paymentStatus,
      });
    }
    if (filter.userId) {
      qb.andWhere('sale.userId = :userId', { userId: filter.userId });
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('sale.createdAt', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async summaryByStore(storeId: string): Promise<{
    totalSales: number;
    totalAmount: number;
  }> {
    const raw = await this.repository
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'totalSales')
      .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'totalAmount')
      .where('sale.storeId = :storeId', { storeId })
      .andWhere('sale.status = :status', { status: 'COMPLETED' })
      .getRawOne();

    return {
      totalSales: Number(raw?.totalSales ?? 0),
      totalAmount: Number(raw?.totalAmount ?? 0),
    };
  }
}

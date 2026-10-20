import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../database/entities';

export interface ProductFilter {
  merchantId: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductsRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repository: Repository<Product>,
  ) {}

  create(data: Partial<Product>): Product {
    return this.repository.create(data);
  }

  save(product: Product): Promise<Product> {
    return this.repository.save(product);
  }

  findByIdAndMerchant(id: string, merchantId: string): Promise<Product | null> {
    return this.repository.findOne({ where: { id, merchantId } });
  }

  findBySkuAndMerchant(
    sku: string,
    merchantId: string,
  ): Promise<Product | null> {
    return this.repository.findOne({ where: { sku, merchantId } });
  }

  /**
   * Tenant scoped list. `merchantId` is mandatory - a product can never be
   * read outside of its own merchant.
   */
  async findMany(
    filter: ProductFilter,
  ): Promise<{ items: Product[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('product')
      .where('product.merchantId = :merchantId', {
        merchantId: filter.merchantId,
      });

    if (filter.status) {
      qb.andWhere('product.status = :status', { status: filter.status });
    }

    if (filter.search) {
      qb.andWhere(
        '(LOWER(product.name) LIKE :search OR LOWER(product.sku) LIKE :search)',
        { search: `%${filter.search.toLowerCase()}%` },
      );
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('product.createdAt', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Bulk fetch scoped to a merchant - used by the sale flow so that a whole
   * basket is loaded in a single query.
   */
  findByIdsAndMerchant(ids: string[], merchantId: string): Promise<Product[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repository
      .createQueryBuilder('product')
      .where('product.merchantId = :merchantId', { merchantId })
      .andWhere('product.id IN (:...ids)', { ids })
      .getMany();
  }
}

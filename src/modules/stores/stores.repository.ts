import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../../database/entities';

@Injectable()
export class StoresRepository {
  constructor(
    @InjectRepository(Store)
    private readonly repository: Repository<Store>,
  ) {}

  create(data: Partial<Store>): Store {
    return this.repository.create(data);
  }

  save(store: Store): Promise<Store> {
    return this.repository.save(store);
  }

  findById(id: string): Promise<Store | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Tenant scoped lookup: a store is only visible inside its own merchant.
   */
  findByIdAndMerchant(id: string, merchantId: string): Promise<Store | null> {
    return this.repository.findOne({ where: { id, merchantId } });
  }

  findByMerchant(merchantId: string): Promise<Store[]> {
    return this.repository.find({
      where: { merchantId },
      order: { createdAt: 'ASC' },
    });
  }
}

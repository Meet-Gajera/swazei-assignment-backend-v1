import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../../database/entities';

@Injectable()
export class MerchantsRepository {
  constructor(
    @InjectRepository(Merchant)
    private readonly repository: Repository<Merchant>,
  ) {}

  create(data: Partial<Merchant>): Merchant {
    return this.repository.create(data);
  }

  save(merchant: Merchant): Promise<Merchant> {
    return this.repository.save(merchant);
  }

  findById(id: string): Promise<Merchant | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Merchant | null> {
    return this.repository.findOne({ where: { name } });
  }
}

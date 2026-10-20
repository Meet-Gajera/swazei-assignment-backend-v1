import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../../common/errors/app.exception';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { Merchant, Store, User } from '../../database/entities';
import { UserRole } from '../../common/enums';
import { MerchantsRepository } from './merchants.repository';

const BCRYPT_SALT_ROUNDS = 10;

export interface CreateMerchantWithOwnerInput {
  merchantName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerName: string;
  storeName: string;
}

export interface CreatedMerchant {
  merchant: Merchant;
  store: Store;
  ownerId: string;
}

@Injectable()
export class MerchantsService {
  constructor(
    private readonly merchantsRepository: MerchantsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Merchant | null> {
    return this.merchantsRepository.findById(id);
  }

  async getOwn(actor: AuthenticatedUser): Promise<Merchant> {
    const merchant = await this.merchantsRepository.findById(actor.merchantId);
    if (!merchant) {
      throw AppException.notFound('Merchant');
    }
    return merchant;
  }

  /**
   * Creates a merchant + its first store + the owner user atomically.
   * Used by the public registration endpoint.
   */
  async createWithOwner(
    input: CreateMerchantWithOwnerInput,
  ): Promise<CreatedMerchant> {
    return this.dataSource.transaction(async (manager) => {
      const merchantRepo = manager.getRepository(Merchant);
      const storeRepo = manager.getRepository(Store);
      const userRepo = manager.getRepository(User);

      const merchant = await merchantRepo.save(
        merchantRepo.create({
          name: input.merchantName,
          status: 'ACTIVE',
        }),
      );

      const store = await storeRepo.save(
        storeRepo.create({
          name: input.storeName,
          merchantId: merchant.id,
          status: 'ACTIVE',
        }),
      );

      const owner = await userRepo.save(
        userRepo.create({
          email: input.ownerEmail.toLowerCase(),
          password: await bcrypt.hash(input.ownerPassword, BCRYPT_SALT_ROUNDS),
          name: input.ownerName,
          role: UserRole.MERCHANT_ADMIN,
          merchantId: merchant.id,
          storeId: store.id,
          status: 'ACTIVE',
        }),
      );

      return { merchant, store, ownerId: owner.id };
    });
  }
}

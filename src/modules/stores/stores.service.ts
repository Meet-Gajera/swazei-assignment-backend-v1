import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app.exception';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserRole } from '../../common/enums';
import { Store } from '../../database/entities';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoresRepository } from './stores.repository';

@Injectable()
export class StoresService {
  constructor(private readonly storesRepository: StoresRepository) {}

  async list(actor: AuthenticatedUser): Promise<Store[]> {
    const stores = await this.storesRepository.findByMerchant(actor.merchantId);
    if (actor.role === UserRole.MERCHANT_ADMIN) {
      return stores;
    }
    return stores.filter((store) => store.id === actor.storeId);
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<Store> {
    const store = await this.storesRepository.findByIdAndMerchant(
      id,
      actor.merchantId,
    );
    if (!store) {
      // Deliberately return 404 (not 403) for foreign tenants so the API does
      // not leak the existence of resources in other merchants.
      throw AppException.notFound('Store');
    }
    if (actor.role !== UserRole.MERCHANT_ADMIN && store.id !== actor.storeId) {
      throw AppException.forbidden(
        'You can only access your own store',
        ErrorCode.CROSS_TENANT_ACCESS,
      );
    }
    return store;
  }

  async create(dto: CreateStoreDto, actor: AuthenticatedUser): Promise<Store> {
    const store = this.storesRepository.create({
      name: dto.name,
      address: dto.address ?? null,
      merchantId: actor.merchantId,
      status: 'ACTIVE',
    });
    return this.storesRepository.save(store);
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    actor: AuthenticatedUser,
  ): Promise<Store> {
    const store = await this.findOne(id, actor);
    if (dto.name) store.name = dto.name;
    if (dto.address !== undefined) store.address = dto.address;
    return this.storesRepository.save(store);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const store = await this.findOne(id, actor);
    await this.storesRepository.save({ ...store, status: 'DELETED' });
  }

  /**
   * Helper used by other modules to assert that a store id belongs to the
   * given merchant (tenant isolation check).
   */
  async belongsToMerchant(
    storeId: string,
    merchantId: string,
  ): Promise<boolean> {
    const store = await this.storesRepository.findByIdAndMerchant(
      storeId,
      merchantId,
    );
    return !!store;
  }

  async findById(id: string): Promise<Store | null> {
    return this.storesRepository.findById(id);
  }
}

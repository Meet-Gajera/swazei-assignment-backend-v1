import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppException, ErrorCode } from '../../common/errors/app.exception';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserRole } from '../../common/enums';
import { MerchantsService } from '../merchants/merchants.service';
import { StoresService } from '../stores/stores.service';
import { User } from '../../database/entities';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly merchantsService: MerchantsService,
    private readonly storesService: StoresService,
  ) {}

  /**
   * Self-service registration: creates the merchant, its first store and the
   * owner account in a single transaction.
   */
  async registerWithMerchant(
    dto: RegisterDto,
  ): Promise<User & { storeId: string | null }> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw AppException.conflict('A user with this email already exists');
    }

    const { merchant, store, ownerId } =
      await this.merchantsService.createWithOwner({
        merchantName: dto.merchantName,
        ownerEmail: dto.email,
        ownerPassword: dto.password,
        ownerName: dto.name,
        storeName: `${dto.merchantName} - Store 1`,
      });

    const user = await this.usersRepository.findById(ownerId);
    if (!user) {
      throw AppException.notFound('User');
    }

    if (dto.storeId && dto.storeId !== store.id) {
      // The store id supplied by the client must belong to the new merchant.
      const belongs = await this.storesService.belongsToMerchant(
        dto.storeId,
        merchant.id,
      );
      if (!belongs) {
        throw AppException.forbidden(
          'Store does not belong to your merchant',
          ErrorCode.CROSS_TENANT_ACCESS,
        );
      }
      user.storeId = dto.storeId;
      await this.usersRepository.save(user);
    }

    return { ...user, storeId: user.storeId };
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw AppException.notFound('User');
    }
    return user;
  }

  async list(actor: AuthenticatedUser): Promise<User[]> {
    return this.usersRepository.findByMerchant(
      actor.merchantId,
      actor.role === UserRole.MERCHANT_ADMIN
        ? undefined
        : (actor.storeId ?? undefined),
    );
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw AppException.notFound('User');
    }
    this.assertSameTenant(user, actor);
    if (
      actor.role !== UserRole.MERCHANT_ADMIN &&
      user.storeId !== actor.storeId
    ) {
      throw AppException.forbidden(
        'User belongs to a different store',
        ErrorCode.CROSS_TENANT_ACCESS,
      );
    }
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<User> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw AppException.conflict('A user with this email already exists');
    }

    const storeId = dto.storeId ?? null;
    if (storeId) {
      const belongs = await this.storesService.belongsToMerchant(
        storeId,
        actor.merchantId,
      );
      if (!belongs) {
        throw AppException.forbidden(
          'Store does not belong to your merchant',
          ErrorCode.CROSS_TENANT_ACCESS,
        );
      }
    } else if (dto.role !== UserRole.MERCHANT_ADMIN) {
      throw AppException.badRequest(
        'storeId is required for STORE_MANAGER and CASHIER users',
      );
    }

    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
      name: dto.name,
      role: dto.role,
      merchantId: actor.merchantId,
      storeId,
      status: 'ACTIVE',
    });

    return this.usersRepository.save(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<User> {
    const user = await this.findOne(id, actor);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.usersRepository.findByEmail(dto.email);
      if (existing) {
        throw AppException.conflict('A user with this email already exists');
      }
      user.email = dto.email.toLowerCase();
    }

    if (dto.name) user.name = dto.name;
    if (dto.role) user.role = dto.role;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }
    if (dto.storeId) {
      const belongs = await this.storesService.belongsToMerchant(
        dto.storeId,
        actor.merchantId,
      );
      if (!belongs) {
        throw AppException.forbidden(
          'Store does not belong to your merchant',
          ErrorCode.CROSS_TENANT_ACCESS,
        );
      }
      user.storeId = dto.storeId;
    }

    return this.usersRepository.save(user);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.findOne(id, actor);
    if (user.id === actor.userId) {
      throw AppException.badRequest('You cannot delete your own account');
    }
    await this.usersRepository.save({ ...user, status: 'DELETED' });
  }

  private assertSameTenant(user: User, actor: AuthenticatedUser) {
    if (user.merchantId !== actor.merchantId) {
      // A user of another merchant simply does not exist inside this tenant.
      // Returning 404 (instead of 403) avoids leaking the existence of
      // resources that belong to somebody else.
      throw AppException.notFound('User');
    }
  }
}

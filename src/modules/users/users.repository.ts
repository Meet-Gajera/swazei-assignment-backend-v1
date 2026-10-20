import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../database/entities';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  create(data: Partial<User>): User {
    return this.repository.create(data);
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  findById(id: string, withPassword = false): Promise<User | null> {
    const query = this.repository
      .createQueryBuilder('user')
      .where('user.id = :id', { id });

    if (withPassword) {
      query.addSelect('user.password');
    }

    return query.getOne();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email: email.toLowerCase() } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  /**
   * Lists users that belong to the given merchant. Tenant scoping is applied
   * inside the repository, so a controller can never accidentally leak users
   * from another merchant.
   */
  findByMerchant(merchantId: string, storeId?: string): Promise<User[]> {
    const qb = this.repository
      .createQueryBuilder('user')
      .where('user.merchantId = :merchantId', { merchantId })
      .orderBy('user.createdAt', 'DESC');

    if (storeId) {
      qb.andWhere('user.storeId = :storeId', { storeId });
    }

    return qb.getMany();
  }

  findByIds(ids: string[]): Promise<User[]> {
    return this.repository.find({ where: { id: In(ids) } });
  }

  countByEmail(email: string): Promise<number> {
    return this.repository.count({ where: { email: email.toLowerCase() } });
  }
}

import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { Product } from '../../database/entities';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async list(
    dto: ListProductsDto,
    actor: AuthenticatedUser,
  ): Promise<{ items: Product[]; total: number; page: number; limit: number }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const result = await this.productsRepository.findMany({
      merchantId: actor.merchantId,
      search: dto.search,
      status: dto.status ?? 'ACTIVE',
      page,
      limit,
    });
    return { ...result, page, limit };
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<Product> {
    const product = await this.productsRepository.findByIdAndMerchant(
      id,
      actor.merchantId,
    );
    if (!product) {
      throw AppException.notFound('Product');
    }
    return product;
  }

  async create(
    dto: CreateProductDto,
    actor: AuthenticatedUser,
  ): Promise<Product> {
    const existing = await this.productsRepository.findBySkuAndMerchant(
      dto.sku,
      actor.merchantId,
    );
    if (existing) {
      throw AppException.conflict(
        `A product with SKU "${dto.sku}" already exists`,
      );
    }

    const product = this.productsRepository.create({
      name: dto.name,
      sku: dto.sku,
      description: dto.description ?? null,
      price: dto.price,
      merchantId: actor.merchantId,
      status: 'ACTIVE',
    });

    return this.productsRepository.save(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actor: AuthenticatedUser,
  ): Promise<Product> {
    const product = await this.findOne(id, actor);

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.productsRepository.findBySkuAndMerchant(
        dto.sku,
        actor.merchantId,
      );
      if (existing) {
        throw AppException.conflict(
          `A product with SKU "${dto.sku}" already exists`,
        );
      }
      product.sku = dto.sku;
    }

    if (dto.name) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price;

    return this.productsRepository.save(product);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const product = await this.findOne(id, actor);
    await this.productsRepository.save({ ...product, status: 'DELETED' });
  }
}

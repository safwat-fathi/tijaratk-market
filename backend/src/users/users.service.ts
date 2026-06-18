import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, Prisma } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOneByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findOneByPhoneWithPassword(phone: string): Promise<User | null> {
    // Prisma returns all scalar fields by default, including password
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findOneById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(
    data: Prisma.UserUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const prismaClient = tx || this.prisma;
    return prismaClient.user.create({ data });
  }

  async updatePassword(id: number, password: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { password },
    });
  }
}

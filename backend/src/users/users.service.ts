import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, Prisma } from '../../generated/prisma/client';
import { hashPassword } from 'src/common/utils/password.util';

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
    const password = await hashPassword(data.password);
    return prismaClient.user.create({ data: { ...data, password } });
  }

  async updatePassword(
    id: number,
    password: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const prismaClient = tx || this.prisma;
    const hashedPassword = await hashPassword(password);
    return prismaClient.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }
}

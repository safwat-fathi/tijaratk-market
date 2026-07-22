import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';

const CLEANUP_INTERVAL_MS = 15 * 60 * 1_000;

type ExpiredDraftFile = {
  prescription_file_path: string | null;
  completed_order_id: number | null;
};

/** Periodically removes expired anonymous carts and their unclaimed uploads. */
@Injectable()
export class StorefrontCartDraftsCleanupWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(StorefrontCartDraftsCleanupWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Starts bounded cleanup without delaying application bootstrap. */
  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
    void this.cleanup();
  }

  /** Releases the recurring cleanup timer. */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Deletes one bounded batch of expired drafts under the cleanup RLS policy. */
  private async cleanup(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const removed = await this.prisma.$transaction(async (manager) => {
        await manager.$executeRaw`SELECT set_config('app.storefront_cart_cleanup', '1', true)`;
        return manager.$queryRaw<ExpiredDraftFile[]>`
          WITH expired AS (
            SELECT id
            FROM storefront_cart_drafts
            WHERE expires_at <= CURRENT_TIMESTAMP
            ORDER BY expires_at ASC
            LIMIT 200
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM storefront_cart_drafts draft
          USING expired
          WHERE draft.id = expired.id
          RETURNING draft.prescription_file_path, draft.completed_order_id
        `;
      });
      await Promise.all(
        removed
          .filter(
            (draft) =>
              draft.prescription_file_path && draft.completed_order_id === null,
          )
          .map((draft) => this.deleteUpload(draft.prescription_file_path!)),
      );
    } catch (error) {
      this.logger.warn(
        `Storefront cart cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Deletes only files within the controlled prescription upload directory. */
  private async deleteUpload(filePath: string): Promise<void> {
    const root = resolve(process.cwd(), 'uploads', 'prescriptions');
    const candidate = resolve(filePath);
    if (!candidate.startsWith(`${root}/`)) return;
    await rm(candidate, { force: true }).catch((error: unknown) => {
      this.logger.warn(
        `Could not delete expired prescription ${candidate}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ManagedAdminRequest } from '../admin-managed.types';

/** Returns the trusted actor context built by the managed-tenant guard. */
export const CurrentAdminActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<ManagedAdminRequest>();
    return request.actorContext;
  },
);

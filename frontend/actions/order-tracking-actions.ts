'use server';

import { revalidatePath } from 'next/cache';

import {
  clearTrackedOrdersCookie,
  removeTrackedOrderFromCookie,
} from '@/lib/tracking/customer-tracking-cookie';
import { ordersService } from '@/services/api/orders.service';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';

export async function clearTrackedOrdersAction() {
  await clearTrackedOrdersCookie();
  revalidatePath('/track-orders');
}

export async function removeTrackedOrderAction(token: string) {
  await removeTrackedOrderFromCookie(token);
  revalidatePath('/track-orders');
}

export async function decideReplacementByTrackingAction(
  token: string,
  itemId: number,
  payload: { decision: 'approve' | 'reject'; reason?: string },
) {
  try {
    const response = await ordersService.decideReplacementByToken(
      token,
      itemId,
      payload,
    );

    revalidatePath(`/track-order/${token}`);
    revalidatePath('/track-orders');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Failed to submit replacement decision:', error);
    return { success: false, error: 'Failed to submit replacement decision' };
  }
}

export async function rejectOrderByTrackingAction(
  token: string,
  payload: { reason?: string },
) {
  try {
    const response = await ordersService.rejectOrderByToken(token, payload);

    await removeTrackedOrderFromCookie(token);

    revalidatePath(`/track-order/${token}`);
    revalidatePath('/track-orders');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Failed to reject order by customer:', error);
    return { success: false, error: 'Failed to reject order' };
  }
}

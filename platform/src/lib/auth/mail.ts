import 'server-only';
import {after} from 'next/server';
import {deliverPendingAccountEmails} from '@/lib/email';

/** Network delivery runs after the generic response, backed by the durable queue. */
export function scheduleAccountEmailDelivery():void {
  after(async () => { await deliverPendingAccountEmails({limit:3}).catch(() => undefined); });
}

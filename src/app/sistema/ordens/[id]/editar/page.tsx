import { notFound } from 'next/navigation';
import { updateOrderAction } from '@/actions/orders';
import { OrderForm } from '@/components/system/orders/OrderForm';
import { DemoBadge, StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { formatOrderCode } from '@/lib/codes';
import { todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getOrderDetail, listOrderItemsForEdit } from '@/server/services/orders';
import { getCompanySettings } from '@/server/services/settings';
import { listTechnicianOptions } from '@/server/services/users';

export const metadata = { title: 'Editar ordem de serviço' };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('orders.edit');
  const { id } = await params;
  const detail = Number.isInteger(Number(id)) ? await getOrderDetail(Number(id)) : null;
  if (!detail) notFound();
  const { order, customer } = detail;
  const [company, technicians, items] = await Promise.all([getCompanySettings(), listTechnicianOptions(), listOrderItemsForEdit(order.id)]);
  const code = formatOrderCode(order.number);

  return (
    <>
      <PageHeader
        title={`Editar ${code}`}
        badges={
          <>
            <StatusBadge status={order.status} /> {order.isDemo ? <DemoBadge /> : null}
          </>
        }
        crumbs={[{ label: 'Ordens de Serviço', href: '/sistema/ordens' }, { label: code, href: `/sistema/ordens/${order.id}` }, { label: 'Editar' }]}
      />
      <OrderForm
        mode="edit"
        action={updateOrderAction}
        order={{
          id: order.id,
          number: order.number,
          status: order.status,
          equipment: order.equipment,
          brand: order.brand,
          model: order.model,
          problemDescription: order.problemDescription,
          diagnosis: order.diagnosis,
          serviceDescription: order.serviceDescription,
          entryDate: order.entryDate,
          expectedDeliveryDate: order.expectedDeliveryDate,
          deliveredDate: order.deliveredDate,
          nextServiceDate: order.nextServiceDate,
          technicianId: order.technicianId,
          paymentMethod: order.paymentMethod,
          discountCents: order.discountCents,
          notes: order.notes,
          items,
        }}
        customer={{ id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, isDemo: customer.isDemo }}
        technicians={technicians}
        today={todayISO(company.timezone)}
        acceptedMethods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
        canCreateCustomer={hasPermission(user, 'customers.create')}
        cancelHref={`/sistema/ordens/${order.id}`}
      />
    </>
  );
}

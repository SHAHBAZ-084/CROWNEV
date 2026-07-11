import { branchApi } from '../api/client';

export async function deleteSaleInvoiceCompletely(orderId: number) {
  try {
    await branchApi.deleteSaleInvoice(orderId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete sale invoice');
  }
}

export async function deletePurchaseInvoiceCompletely(purchaseId: number) {
  try {
    await branchApi.deletePurchaseInvoice(purchaseId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete purchase invoice');
  }
}

export async function deleteServiceInvoiceCompletely(id: number) {
  try {
    await branchApi.deleteServiceInvoice(id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete service invoice');
  }
}

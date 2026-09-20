import { InvoiceItem } from '../InvoiceItem/InvoiceItem';

export class SalesInvoiceItem extends InvoiceItem {
  purchaseInvoice?: string;
  purchaseInvoiceItem?: string;
}

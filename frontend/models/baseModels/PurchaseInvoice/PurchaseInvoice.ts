import { Fyo } from 'fyo';
import { Action, ListViewSettings } from 'fyo/model/types';
import { ModelNameEnum } from 'models/types';
import { getInvoiceActions, getTransactionStatusColumn } from '../../helpers';
import { Invoice } from '../Invoice/Invoice';
import { PurchaseInvoiceItem } from '../PurchaseInvoiceItem/PurchaseInvoiceItem';
import { createBatch } from 'models/inventory/helpers';

export class PurchaseInvoice extends Invoice {
  items?: PurchaseInvoiceItem[];
  investment?: string;
  investor?: string;

  async _applyChange(
    fieldname: string,
    retriggerChildDocApplyChange?: boolean
  ): Promise<boolean | undefined> {
    const result = await super._applyChange(
      fieldname,
      retriggerChildDocApplyChange
    );

    if (fieldname === 'investment') {
      if (this.investment) {
        const investor = (await this.fyo.getValue(
          ModelNameEnum.Investment,
          this.investment,
          'investor'
        )) as string | null;
        if (investor) {
          await this.set('investor', investor);
        }
        for (const row of this.items ?? []) {
          if (!row.investment) {
            await row.set('investment', this.investment);
          }
        }
      } else {
        await this.set('investor', null);
      }
    }

    return result;
  }

  async beforeSubmit(): Promise<void> {
    await super.beforeSubmit();

    if (this.isReturn) {
      return;
    }

    const batchesToCreate: { item: string; batch: string }[] = [];

    for (const item of this.items ?? []) {
      if (!item.item || !item.batch) {
        continue;
      }

      const hasBatch = await this.fyo.getValue(
        ModelNameEnum.Item,
        item.item,
        'hasBatch'
      );

      if (hasBatch) {
        batchesToCreate.push({
          item: item.item,
          batch: item.batch,
        });
      }
    }

    for (const { item, batch } of batchesToCreate) {
      await createBatch(this.fyo, item, batch);
    }
  }

  static getListViewSettings(): ListViewSettings {
    return {
      columns: [
        'name',
        getTransactionStatusColumn(),
        'party',
        'investment',
        'date',
        'baseGrandTotal',
        'outstandingAmount',
      ],
    };
  }

  static getActions(fyo: Fyo): Action[] {
    return getInvoiceActions(fyo, ModelNameEnum.PurchaseInvoice);
  }
}

import { Fyo } from 'fyo';
import { Doc } from 'fyo/model/doc';
import { Action, FormulaMap, ListViewSettings } from 'fyo/model/types';
import { isPesa } from 'fyo/utils';
import { dialog } from 'frappe-ui';
import { DateTime } from 'luxon';
import { call } from 'src/web/api';
import { showToast } from 'src/utils/interactive';
import { InvestmentReinvestment } from '../InvestmentReinvestment/InvestmentReinvestment';

function amountToString(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  if (isPesa(value)) {
    return String(value.float);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

function promptReinvest(doc: Doc) {
  const today = DateTime.now().toFormat('yyyy-MM-dd');
  const defaultAmount = amountToString(doc.get('payoutDue'));

  dialog.prompt({
    title: doc.fyo.t`Reinvest`,
    confirmLabel: doc.fyo.t`Add Reinvestment`,
    fields: [
      {
        name: 'amount',
        label: doc.fyo.t`Amount`,
        type: 'text',
        required: true,
        defaultValue: defaultAmount,
        validate: (value) => {
          const n = Number(value);
          if (!Number.isFinite(n) || n <= 0) {
            return doc.fyo.t`Amount must be greater than zero`;
          }
          return null;
        },
      },
      {
        name: 'date',
        label: doc.fyo.t`Date`,
        type: 'text',
        required: true,
        defaultValue: today,
        placeholder: 'yyyy-MM-dd',
        validate: (value) => {
          const parsed = DateTime.fromFormat(String(value ?? ''), 'yyyy-MM-dd');
          if (!parsed.isValid) {
            return doc.fyo.t`Enter date as yyyy-MM-dd`;
          }
          return null;
        },
      },
      {
        name: 'remarks',
        label: doc.fyo.t`Remarks`,
        type: 'textarea',
      },
    ],
    onConfirm: async ({ values, setError }) => {
      if (!doc.name) {
        setError(doc.fyo.t`Save the Investment before reinvesting`);
        throw new Error('Investment not saved');
      }

      const amount = Number(values.amount);
      try {
        await call(
          'investment.investment.doctype.investment.investment.add_reinvestment',
          {
            investment: doc.name,
            amount,
            date: values.date,
            remarks: values.remarks || null,
          }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? '');
        setError(message || doc.fyo.t`Could not add reinvestment`);
        throw error instanceof Error ? error : new Error(message);
      }

      await doc.load();
      showToast({
        type: 'success',
        message: doc.fyo.t`Reinvestment added`,
        duration: 'short',
      });
    },
  });
}

export class Investment extends Doc {
  investor?: string;
  investorName?: string;
  date?: Date | string;
  status?: string;
  amount?: unknown;
  totalReinvested?: unknown;
  totalCapital?: unknown;
  linkedPurchaseCost?: unknown;
  linkedSalesAmount?: unknown;
  margin?: unknown;
  investorProfitPercent?: number;
  investorProfit?: unknown;
  totalPaidOut?: unknown;
  payoutDue?: unknown;
  reinvestments?: InvestmentReinvestment[];

  formulas: FormulaMap = {
    investorName: async () => {
      if (!this.investor) {
        return null;
      }
      // Investor uses Party-style naming: name is the display name
      return this.investor;
    },
    investorProfit: {
      formula: async () => {
        const margin = this.fyo.pesa(this.margin ?? 0);
        const percent = Number(this.investorProfitPercent ?? 100);
        return margin.mul(percent).div(100);
      },
      dependsOn: ['margin', 'investorProfitPercent'],
    },
    payoutDue: {
      formula: async () => {
        const capital = this.fyo.pesa(this.totalCapital ?? this.amount ?? 0);
        const profit = this.fyo.pesa(this.investorProfit ?? 0);
        const paid = this.fyo.pesa(this.totalPaidOut ?? 0);
        return capital.add(profit).sub(paid);
      },
      dependsOn: ['totalCapital', 'amount', 'investorProfit', 'totalPaidOut'],
    },
  };

  static getActions(fyo: Fyo): Action[] {
    return [
      {
        label: fyo.t`Reinvest`,
        group: fyo.t`Action`,
        condition: (doc: Doc) =>
          !doc.notInserted && doc.get('status') !== 'Closed',
        action: async (doc) => {
          promptReinvest(doc);
        },
      },
    ];
  }

  static getListViewSettings(): ListViewSettings {
    return {
      columns: [
        'name',
        'investor',
        'date',
        'status',
        'amount',
        'linkedPurchaseCost',
        'totalCapital',
        'payoutDue',
      ],
    };
  }
}

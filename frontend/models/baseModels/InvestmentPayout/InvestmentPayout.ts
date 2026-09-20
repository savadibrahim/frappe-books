import { Doc } from 'fyo/model/doc';
import { FormulaMap, ListViewSettings } from 'fyo/model/types';
import { isPesa } from 'fyo/utils';
import { Fyo } from 'fyo';
import { call } from 'src/web/api';

type PayoutDueResponse = {
  payout_due?: number | string;
  investor?: string;
  investor_name?: string;
};

type InvestmentRow = {
  investor?: string;
  investorName?: string;
  amount?: unknown;
  totalCapital?: unknown;
  investorProfit?: unknown;
  totalPaidOut?: unknown;
  payoutDue?: unknown;
};

function toAmountNumber(fyo: Fyo, value: unknown): number {
  if (value == null || value === '') {
    return 0;
  }
  if (isPesa(value)) {
    return Number(value.float) || 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    return Number(fyo.pesa(value as string | number).float) || 0;
  } catch {
    return 0;
  }
}

function dueFromInvestment(fyo: Fyo, inv: InvestmentRow | null | undefined): number {
  if (!inv) {
    return 0;
  }
  const stored = toAmountNumber(fyo, inv.payoutDue);
  const computed =
    toAmountNumber(fyo, inv.totalCapital ?? inv.amount) +
    toAmountNumber(fyo, inv.investorProfit) -
    toAmountNumber(fyo, inv.totalPaidOut);
  // Prefer live computed when stored is empty/stale zero but capital exists
  if (stored === 0 && computed > 0) {
    return computed;
  }
  return stored || computed;
}

async function fetchPayoutDue(investment: string): Promise<PayoutDueResponse | null> {
  try {
    return await call<PayoutDueResponse>(
      'investment.investment.doctype.investment.investment.get_payout_due',
      { investment }
    );
  } catch {
    return null;
  }
}

export class InvestmentPayout extends Doc {
  investment?: string;
  investor?: string;
  investorName?: string;
  date?: Date | string;
  status?: string;
  payoutDue?: unknown;
  amount?: unknown;
  remarks?: string;

  formulas: FormulaMap = {
    investor: {
      formula: async () => {
        if (!this.investment) {
          return null;
        }
        const due = await fetchPayoutDue(this.investment);
        if (due?.investor) {
          return due.investor;
        }
        const inv = (await this.fyo.db.get(
          'Investment',
          this.investment
        )) as InvestmentRow | null;
        return inv?.investor ?? null;
      },
      dependsOn: ['investment'],
    },
    investorName: {
      formula: async () => {
        if (!this.investment) {
          return null;
        }
        const due = await fetchPayoutDue(this.investment);
        if (due?.investor_name) {
          return due.investor_name;
        }
        const inv = (await this.fyo.db.get(
          'Investment',
          this.investment
        )) as InvestmentRow | null;
        return inv?.investorName ?? inv?.investor ?? null;
      },
      dependsOn: ['investment'],
    },
    payoutDue: {
      formula: async () => {
        if (!this.investment) {
          return this.fyo.pesa(0);
        }

        let n = 0;
        const due = await fetchPayoutDue(this.investment);
        if (due && due.payout_due != null && due.payout_due !== '') {
          n = toAmountNumber(this.fyo, due.payout_due);
        }

        if (!n) {
          const inv = (await this.fyo.db.get(
            'Investment',
            this.investment
          )) as InvestmentRow | null;
          n = dueFromInvestment(this.fyo, inv);
        }

        if (this.notInserted) {
          const amt = toAmountNumber(this.fyo, this.amount);
          if (amt === 0 && n > 0) {
            this.amount = this.fyo.pesa(n);
          }
        }

        return this.fyo.pesa(n);
      },
      dependsOn: ['investment'],
    },
  };

  static getListViewSettings(): ListViewSettings {
    return {
      columns: [
        'name',
        'investment',
        'investor',
        'date',
        'status',
        'payoutDue',
        'amount',
      ],
    };
  }
}

import { Doc } from 'fyo/model/doc';
import { FormulaMap, ListViewSettings } from 'fyo/model/types';
import { InvestmentReinvestment } from '../InvestmentReinvestment/InvestmentReinvestment';

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

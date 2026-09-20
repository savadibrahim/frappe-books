import { Doc } from 'fyo/model/doc';

export class InvestmentReinvestment extends Doc {
  date?: Date | string;
  amount?: unknown;
  remarks?: string;
}

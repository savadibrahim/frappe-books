import { Doc } from 'fyo/model/doc';
import { ListViewSettings } from 'fyo/model/types';

export class Investor extends Doc {
  email?: string;
  phone?: string;
  disabled?: boolean;

  static getListViewSettings(): ListViewSettings {
    return {
      columns: ['name', 'email', 'phone'],
    };
  }
}

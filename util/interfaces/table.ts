import { TableColumn } from "./tableColumn";

export interface Table {
  tableName: string;
  tableCols: TableColumn[]
}
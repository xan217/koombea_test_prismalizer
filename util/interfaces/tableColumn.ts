export interface TableColumn {
  id: number;
  name: string;
  type: string;
  longitude?: number;
  default?: string;
  pk: boolean;
  nullable: boolean;
  autoincremental: boolean;
  unique: boolean
  relations?: {
    fields: string;
    references: string;
  }
}

export const defaultTableColumn = {
  id: -1,
  name: "",
  type: "String",
  pk: false,
  longitude: 0,
  nullable: false,
  autoincremental: false,
  unique: false,
};

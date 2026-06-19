import NodeSqlParser from "node-sql-parser";
import type { Option } from "node-sql-parser";

const { Parser } = NodeSqlParser;

export const pgParser = new Parser();

export const PG_PARSE_OPT: Option = { database: "Postgresql" };

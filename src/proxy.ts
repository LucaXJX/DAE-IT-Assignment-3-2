import { proxySchema } from "better-sqlite3-proxy";
import { db } from "./db";

export type Images = {
  id?: null | number;
  url: string;
  alt_text: string;
  file_name: string;
  download_status: "pending" | "downloading" | "downloaded" | "failed";
  process_status: "pending" | "processing" | "processed" | "failed";
  file_size: number;
  width: number;
  height: number;
  error_message: string;
  created_at: string;
  updated_at: string;
};

export type DBProxy = {
  images: Images[];
};

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    images: [],
  },
});

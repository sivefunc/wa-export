// Shared settings for the live-testing scripts; override with environment variables.
import { resolve } from "node:path";

export const CDP_PORT = Number(process.env.WA_EXPORT_CDP_PORT ?? 9333);
export const CDP_URL = `http://localhost:${CDP_PORT}`;
export const PROFILE_DIR = resolve(process.env.WA_EXPORT_PROFILE_DIR ?? ".live/profile");
export const DOWNLOADS_DIR = resolve(process.env.WA_EXPORT_DOWNLOADS_DIR ?? ".live/downloads");

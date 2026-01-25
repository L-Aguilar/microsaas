"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
var pg_1 = require("pg");
var node_postgres_1 = require("drizzle-orm/node-postgres");
var schema = __importStar(require("@shared/schema"));
if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error("SUPABASE_DATABASE_URL must be set. Get it from your Supabase project settings.");
}
var databaseUrl = process.env.SUPABASE_DATABASE_URL;
// Create connection pool with optimized settings for Supabase
exports.pool = new pg_1.Pool({
    connectionString: databaseUrl,
    max: 10, // Reduced from 20 to prevent connection overload
    idleTimeoutMillis: 60000, // Increased to 60 seconds
    connectionTimeoutMillis: 10000, // Increased to 10 seconds
    statement_timeout: 60000, // 60 second query timeout
    ssl: {
        rejectUnauthorized: false // Required for Supabase pooler connections
    }
});
exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema: schema });

/**
 * Configuration management using environment variables.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  supabase: {
    projectId: string;
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
  };
  app: {
    logLevel: string;
    nodeEnv: string;
  };
  suppliers: {
    athlon: {
      apiKey?: string;
      apiUrl?: string;
    };
  };
  paths: {
    uploadDir: string;
    exportDir: string;
  };
  matching: {
    confidenceThreshold: number;
    reviewThreshold: number;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

function getNumberEnvVar(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

export const config: Config = {
  database: {
    url: getEnvVar('DATABASE_URL', 'postgresql://localhost:5432/leaseconnect'),
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getNumberEnvVar('DB_PORT', 5432),
    name: getEnvVar('DB_NAME', 'leaseconnect'),
    user: getEnvVar('DB_USER', 'postgres'),
    password: getEnvVar('DB_PASSWORD', 'postgres'),
  },
  supabase: {
    projectId: getEnvVar('SUPABASE_PROJECT_ID', 'qkcjlbycgytlinsblrja'),
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  app: {
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
  },
  suppliers: {
    athlon: {
      apiKey: process.env.ATHLON_API_KEY,
      apiUrl: process.env.ATHLON_API_URL,
    },
  },
  paths: {
    uploadDir: getEnvVar('UPLOAD_DIR', './uploads'),
    exportDir: getEnvVar('EXPORT_DIR', './exports'),
  },
  matching: {
    confidenceThreshold: parseFloat(getEnvVar('MATCHING_CONFIDENCE_THRESHOLD', '0.8')),
    reviewThreshold: parseFloat(getEnvVar('MATCHING_REVIEW_THRESHOLD', '0.6')),
  },
};


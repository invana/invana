

/**
 * Mapper utility for insurance database schema visualization
 * This file contains sample data structures representing PostgreSQL databases
 * with tables, views, indexes, and ETL system connections to Tableau dashboards
 */

// Types for the database structure
export interface Column {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface Index {
  name: string;
  columns: string[];
  isUnique?: boolean;
}

export interface Table {
  name: string;
  schema: string;
  description: string;
  columns: Column[];
  indexes: Index[];
}

export interface View {
  name: string;
  schema: string;
  description: string;
  definition: string;
  columns: Column[];
}

export interface Database {
  name: string;
  tables: Table[];
  views: View[];
}

export interface TableauDashboard {
  name: string;
  description: string;
  sourceTables: string[];
  sourceColumns: {
    table: string;
    columns: string[];
  }[];
}

export interface ETLProcess {
  name: string;
  description: string;
  sourceTables: string[];
  targetTables: string[];
  schedule: string;
  dashboards: string[];
}

// Mock Insurance Database System
export const insuranceSystem = {
  databases: [
    {
      name: "insurance_prod",
      tables: [
        {
          name: "customers",
          schema: "public",
          description: "Customer personal and contact information",
          columns: [
            { name: "customer_id", type: "uuid", isPrimaryKey: true },
            { name: "first_name", type: "varchar(100)" },
            { name: "last_name", type: "varchar(100)" },
            { name: "date_of_birth", type: "date" },
            { name: "email", type: "varchar(255)" },
            { name: "phone", type: "varchar(20)" },
            { name: "address", type: "text" },
            { name: "city", type: "varchar(100)" },
            { name: "state", type: "varchar(50)" },
            { name: "zip_code", type: "varchar(20)" },
            { name: "created_at", type: "timestamp" },
            { name: "updated_at", type: "timestamp" }
          ],
          indexes: [
            { name: "idx_customers_email", columns: ["email"], isUnique: true },
            { name: "idx_customers_name", columns: ["last_name", "first_name"] }
          ]
        },
        {
          name: "policies",
          schema: "public",
          description: "Insurance policies information",
          columns: [
            { name: "policy_id", type: "uuid", isPrimaryKey: true },
            {
              name: "customer_id", type: "uuid", isForeignKey: true,
              references: { table: "customers", column: "customer_id" }
            },
            {
              name: "agent_id", type: "uuid", isForeignKey: true,
              references: { table: "agents", column: "agent_id" }
            },
            { name: "policy_number", type: "varchar(50)" },
            { name: "policy_type", type: "varchar(50)" },
            { name: "coverage_amount", type: "decimal(15,2)" },
            { name: "premium_amount", type: "decimal(15,2)" },
            { name: "start_date", type: "date" },
            { name: "end_date", type: "date" },
            { name: "status", type: "varchar(20)" },
            { name: "created_at", type: "timestamp" },
            { name: "updated_at", type: "timestamp" }
          ],
          indexes: [
            { name: "idx_policies_number", columns: ["policy_number"], isUnique: true },
            { name: "idx_policies_customer", columns: ["customer_id"] },
            { name: "idx_policies_status", columns: ["status"] }
          ]
        },
        {
          name: "claims",
          schema: "public",
          description: "Insurance claims data",
          columns: [
            { name: "claim_id", type: "uuid", isPrimaryKey: true },
            {
              name: "policy_id", type: "uuid", isForeignKey: true,
              references: { table: "policies", column: "policy_id" }
            },
            { name: "claim_number", type: "varchar(50)" },
            { name: "incident_date", type: "date" },
            { name: "filing_date", type: "date" },
            { name: "description", type: "text" },
            { name: "claim_amount", type: "decimal(15,2)" },
            { name: "status", type: "varchar(20)" },
            { name: "resolution_date", type: "date" },
            { name: "created_at", type: "timestamp" },
            { name: "updated_at", type: "timestamp" }
          ],
          indexes: [
            { name: "idx_claims_number", columns: ["claim_number"], isUnique: true },
            { name: "idx_claims_policy", columns: ["policy_id"] },
            { name: "idx_claims_status", columns: ["status"] }
          ]
        }
      ],
      views: [
        {
          name: "active_policies",
          schema: "public",
          description: "All currently active insurance policies",
          definition: "SELECT * FROM policies WHERE status = 'ACTIVE' AND end_date > CURRENT_DATE",
          columns: [
            { name: "policy_id", type: "uuid" },
            { name: "customer_id", type: "uuid" },
            { name: "policy_number", type: "varchar(50)" },
            { name: "policy_type", type: "varchar(50)" },
            { name: "premium_amount", type: "decimal(15,2)" },
            { name: "end_date", type: "date" }
          ]
        }
      ]
    },
    {
      name: "insurance_analytics",
      tables: [
        {
          name: "policy_metrics",
          schema: "analytics",
          description: "Aggregated policy statistics for reporting",
          columns: [
            { name: "metric_id", type: "serial", isPrimaryKey: true },
            { name: "policy_type", type: "varchar(50)" },
            { name: "region", type: "varchar(50)" },
            { name: "month", type: "date" },
            { name: "total_policies", type: "integer" },
            { name: "active_policies", type: "integer" },
            { name: "new_policies", type: "integer" },
            { name: "canceled_policies", type: "integer" },
            { name: "total_premium", type: "decimal(15,2)" },
            { name: "average_premium", type: "decimal(15,2)" }
          ],
          indexes: [
            { name: "idx_metrics_date_type", columns: ["month", "policy_type"] },
            { name: "idx_metrics_region", columns: ["region"] }
          ]
        }
      ],
      views: []
    }
  ],

  etlProcesses: [
    {
      name: "daily_policy_transfer",
      description: "Extracts policy data from production to analytics",
      sourceTables: ["insurance_prod.public.policies", "insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.policy_metrics"],
      schedule: "Daily at 01:00 AM",
      dashboards: ["policy_performance", "regional_analysis"]
    }
  ],

  tableauDashboards: [
    {
      name: "policy_performance",
      description: "Analysis of policy renewal rates and premium trends",
      sourceTables: ["insurance_analytics.analytics.policy_metrics"],
      sourceColumns: [
        {
          table: "policy_metrics",
          columns: ["policy_type", "month", "total_policies", "active_policies", "total_premium", "average_premium"]
        }
      ]
    },
    {
      name: "claims_processing",
      description: "Claims processing time and resolution metrics",
      sourceTables: ["insurance_prod.public.claims"],
      sourceColumns: [
        {
          table: "claims",
          columns: ["incident_date", "filing_date", "resolution_date", "status", "claim_amount"]
        }
      ]
    }
  ]
};

export default insuranceSystem;
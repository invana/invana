

/**
 * Mapper utility for insurance database schema visualization
 * This file contains sample data structures representing PostgreSQL databases
 * with tables, views, indexes, and ETL system connections to Tableau dashboards
 */
import { Node, Edge } from '@xyflow/react';
import { Columns, Database, LayoutDashboard, Table, Table2, View } from 'lucide-react';
import React from 'react';

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
        },
        {
          name: "customer_analytics",
          schema: "analytics",
          description: "Customer demographic and behavior analysis",
          columns: [
            { name: "customer_metric_id", type: "serial", isPrimaryKey: true },
            { name: "age_group", type: "varchar(20)" },
            { name: "region", type: "varchar(50)" },
            { name: "state", type: "varchar(50)" },
            { name: "customer_count", type: "integer" },
            { name: "avg_policies_per_customer", type: "decimal(5,2)" },
            { name: "customer_lifetime_value", type: "decimal(15,2)" },
            { name: "retention_rate", type: "decimal(5,2)" },
            { name: "month", type: "date" },
            { name: "updated_at", type: "timestamp" }
          ],
          indexes: [
            { name: "idx_customer_analytics_region", columns: ["region"] },
            { name: "idx_customer_analytics_age", columns: ["age_group"] }
          ]
        },
        {
          name: "claims_analytics",
          schema: "analytics",
          description: "Claims analysis and risk assessment",
          columns: [
            { name: "claims_metric_id", type: "serial", isPrimaryKey: true },
            { name: "policy_type", type: "varchar(50)" },
            { name: "region", type: "varchar(50)" },
            { name: "month", type: "date" },
            { name: "total_claims", type: "integer" },
            { name: "approved_claims", type: "integer" },
            { name: "rejected_claims", type: "integer" },
            { name: "pending_claims", type: "integer" },
            { name: "average_claim_amount", type: "decimal(15,2)" },
            { name: "total_payout", type: "decimal(15,2)" },
            { name: "average_processing_days", type: "decimal(5,1)" }
          ],
          indexes: [
            { name: "idx_claims_analytics_type", columns: ["policy_type"] },
            { name: "idx_claims_analytics_region", columns: ["region"] }
          ]
        },
        {
          name: "agent_performance",
          schema: "analytics",
          description: "Sales agent performance metrics",
          columns: [
            { name: "performance_id", type: "serial", isPrimaryKey: true },
            { name: "agent_id", type: "uuid" },
            { name: "month", type: "date" },
            { name: "policies_sold", type: "integer" },
            { name: "premium_generated", type: "decimal(15,2)" },
            { name: "customer_satisfaction", type: "decimal(3,1)" },
            { name: "renewal_rate", type: "decimal(5,2)" },
            { name: "region", type: "varchar(50)" }
          ],
          indexes: [
            { name: "idx_agent_performance_agent", columns: ["agent_id"] },
            { name: "idx_agent_performance_month", columns: ["month"] }
          ]
        }
      ],
      views: []
    }
  ],

  etlProcesses: [
    {
      name: "daily_policy_transfer_etl",
      description: "Extracts policy data from production to analytics",
      sourceTables: ["insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.policy_metrics"],
      schedule: "Daily at 01:00 AM",
      dashboards: ["policy_performance", "financial_overview"]
    },
    {
      name: "customer_segmentation_etl",
      description: "Processes customer data for demographic analysis",
      sourceTables: ["insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.customer_analytics"],
      schedule: "Daily at 02:00 AM",
      dashboards: ["customer_insights", "regional_performance"]
    },
    {
      name: "claims_analytics_etl",
      description: "Processes claims data for risk and payout analysis",
      sourceTables: ["insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.claims_analytics"],
      schedule: "Daily at 03:00 AM",
      dashboards: ["claims_processing", "risk_management", "financial_overview"]
    },
    {
      name: "agent_performance_etl",
      description: "Analyzes agent sales and customer satisfaction metrics",
      sourceTables: ["insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.agent_performance"],
      schedule: "Daily at 04:00 AM",
      dashboards: ["agent_performance", "regional_performance"]
    },
    {
      name: "comprehensive_risk_etl",
      description: "Combines all data sources for holistic risk assessment",
      sourceTables: ["insurance_prod.public.customers"],
      targetTables: ["insurance_analytics.analytics.claims_analytics", "insurance_analytics.analytics.policy_metrics"],
      schedule: "Weekly on Sunday at 01:00 AM",
      dashboards: ["risk_management", "executive_dashboard"]
    }
  ],

  tableauDashboards: [
    {
      name: "policy_performance",
      description: "Analysis of policy renewal rates and premium trends",
      sourceTables: ["insurance_analytics.analytics.policy_metrics"],
      sourceColumns: [
        {
          table: "insurance_analytics.policy_metrics",
          columns: ["policy_type", "month", "total_policies", "active_policies", "total_premium", "average_premium"]
        }
      ]
    },
    {
      name: "claims_processing",
      description: "Claims processing time and resolution metrics",
      sourceTables: ["insurance_analytics.analytics.claims_analytics"],
      sourceColumns: [
        {
          table: "insurance_analytics.claims_analytics",
          columns: ["total_claims", "average_processing_days", "total_payout", "average_claim_amount"]
        }
      ]
    },
    {
      name: "customer_insights",
      description: "Customer demographic analysis and behavior patterns",
      sourceTables: ["insurance_analytics.analytics.customer_analytics"],
      sourceColumns: [
        {
          table: "insurance_analytics.customer_analytics",
          columns: ["age_group", "region", "state", "customer_count", "avg_policies_per_customer", "retention_rate"]
        }
      ]
    },
    {
      name: "risk_management",
      description: "Risk analysis and fraud detection patterns",
      sourceTables: ["insurance_analytics.analytics.claims_analytics", "insurance_analytics.analytics.policy_metrics"],
      sourceColumns: [
        {
          table: "insurance_analytics.claims_analytics",
          columns: ["policy_type", "region", "total_claims", "approved_claims", "rejected_claims", "average_claim_amount"]
        },
        {
          table: "insurance_analytics.policy_metrics",
          columns: ["policy_type", "total_policies", "new_policies"]
        }
      ]
    },
    {
      name: "agent_performance",
      description: "Sales performance metrics by agent and region",
      sourceTables: ["insurance_analytics.analytics.agent_performance"],
      sourceColumns: [
        {
          table: "insurance_analytics.agent_performance",
          columns: ["month", "agent_id", "policies_sold", "premium_generated", "customer_satisfaction", "renewal_rate", "region"]
        }
      ]
    },
    {
      name: "financial_overview",
      description: "Premium income versus claims payout analysis",
      sourceTables: ["insurance_analytics.analytics.policy_metrics", "insurance_analytics.analytics.claims_analytics"],
      sourceColumns: [
        {
          table: "insurance_analytics.policy_metrics",
          columns: ["month", "total_premium", "policy_type"]
        },
        {
          table: "insurance_analytics.claims_analytics",
          columns: ["month", "total_payout", "policy_type"]
        }
      ]
    },
    {
      name: "regional_performance",
      description: "Performance metrics by geographic region",
      sourceTables: ["insurance_analytics.analytics.policy_metrics", "insurance_analytics.analytics.customer_analytics", "insurance_analytics.analytics.agent_performance"],
      sourceColumns: [
        {
          table: "insurance_analytics.policy_metrics",
          columns: ["region", "total_policies", "total_premium"]
        },
        {
          table: "insurance_analytics.customer_analytics",
          columns: ["region", "state", "customer_count"]
        },
        {
          table: "insurance_analytics.agent_performance",
          columns: ["region", "policies_sold"]
        }
      ]
    },
    {
      name: "executive_dashboard",
      description: "High-level KPIs for executive decision making",
      sourceTables: ["insurance_analytics.analytics.policy_metrics", "insurance_analytics.analytics.claims_analytics", "insurance_analytics.analytics.customer_analytics"],
      sourceColumns: [
        {
          table: "insurance_analytics.policy_metrics",
          columns: ["total_policies", "total_premium", "new_policies"]
        },
        {
          table: "insurance_analytics.claims_analytics",
          columns: ["total_claims", "total_payout", "average_processing_days"]
        },
        {
          table: "insurance_analytics.customer_analytics",
          columns: ["customer_count", "retention_rate", "customer_lifetime_value"]
        }
      ]
    }
  ],
}


export const getData = () => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Track node IDs for edge creation
  const tableIds: { [key: string]: string } = {};

  // Create database nodes
  insuranceSystem.databases.forEach((db, dbIndex) => {
    const dbId = `db_${db.name}`;

    // Add database node
    const database = {
      id: dbId,
      type: "DataTreeNode",
      data: {
        type: 'database',
        headerTitle: db.name.replace('_', ' ').charAt(0).toUpperCase() + db.name.replace('_', ' ').slice(1),
        icon: <Database className="h-4 w-4" />,

        name: db.name,
        searchable: true,
        children: db.tables.map((table) => {
          return {
            label: table.name,
            id: `${dbId}_table_${table.name}`,
            icon: <Table className="h-4 w-4 shrink-0  __text-gray-500" />
          }
        })
      }
    }
    nodes.push(database);

    console.log("====nodes", JSON.stringify(database), db.tables)

    // Add table nodes
    db.tables.forEach((table, tableIndex) => {
      const tableId = `table_${table.name}`;
      tableIds[table.name] = tableId;

      // Add table node
      nodes.push({
        id: tableId,
        type: "DataTreeNode",
        data: {
          type: 'table',
          headerTitle: table.name,
          headerDescription: table.description,
          icon: <Table className="h-4 w-4" />,
          searchable: true,
          children: [
            {
              label: "Columns",
              id: `${tableId}_columns`,
              icon: <Columns className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: table.columns.map((column) => {
                return {
                  label: column.name,
                  id: `${tableId}_column_${column.name}`,
                  // icon: <Columns className="h-4 w-4 shrink-0  __text-gray-500" />
                };
              })
            },
            {
              label: "Indexes",
              id: `${tableId}_indexes`,
              icon: <View className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: table.indexes.map((index) => {
                return {
                  label: index.name,
                  id: `${tableId}_index_${index.name}`,
                  // icon: <Index className="h-4 w-4 shrink-0  __text-gray-500" />
                };
              })
            }
          ]
        },
        position: {
          x: 0,
          y: 0
        }
      });

      // Connect database to table
      edges.push({
        id: `e_${dbId}_${tableId}`,
        source: dbId,
        sourceHandle: `${dbId}_table_${table.name}`,
        target: tableId,
      });
    });

  });


  // Add ETL process nodes
  insuranceSystem.etlProcesses.forEach((etl, etlIndex) => {
    const etlId = `etl_${etl.name}`;

    // Add ETL node
    nodes.push({
      id: etlId,
      type: "DataTreeNode",

      data: {
        type: 'etl',
        headerTitle: etl.name,
        schedule: etl.schedule,
        headerDescription: etl.description,
        children: etl.dashboards.map((dashboard) => {
          return {
            label: dashboard,
            id: `${etlId}_${dashboard}`,
            icon: <LayoutDashboard className="h-4 w-4 shrink-0  __text-gray-500" />
          };
        })
      },
      position: {
        x: 0,
        y: 0
      }
    });





  });
  const getDashboard = (dashboardName: string): TableauDashboard | undefined => {
    return insuranceSystem.tableauDashboards.find((dashboard) => {
      console.log("dashboard.name", dashboard.name, dashboardName, dashboard.name === dashboardName)
      return dashboard.name === dashboardName;
    });
  }
  insuranceSystem.etlProcesses.forEach(etlProcess => {
    etlProcess.dashboards.forEach(dashboardName => {
      const dashboard = getDashboard(dashboardName);
      console.log("=====dashboard", dashboard, dashboardName)
      dashboard?.sourceColumns.forEach((sourceCol) => {
        // edges between table/column and etl/dashboard 
        sourceCol.columns.forEach(column => {
          const tableId = `table_${sourceCol.table.split(".")[1]}`
          const etlId = `etl_${etlProcess.name}`;
          const edge = {
            id: `${tableId}_column_${column}_${etlId}_${dashboard.name}`,
            source: tableId,
            sourceHandle: `${tableId}_column_${column}`,
            target: etlId,
            targetHandle: `${etlId}_${dashboard.name}`
          }
          edges.push(edge);
        });

        // edges between etl/dashboard to dashboard/column 
        sourceCol.columns.forEach((column) => {
          const etlId = `etl_${etlProcess.name}`;
          const dashboardId = `dashboard_${dashboard.name}`;
          // Check if the target handle exists before creating the edge
          const edge = {
            id: `${etlId}_${dashboard.name}_${dashboardId}_${column}`,
            source: etlId,
            sourceHandle: `${etlId}_${dashboard.name}`,
            target: dashboardId,
            // Make sure this ID matches exactly what's defined in the dashboard node's children
            targetHandle: `${dashboardId}_${column}`,
          }
          edges.push(edge);
        });
      })

    })
  })
  // Add dashboard nodes
  insuranceSystem.tableauDashboards.forEach((dashboard, dashboardIndex) => {
    const dashboardId = `dashboard_${dashboard.name}`;

    // Add dashboard node
    nodes.push({
      id: dashboardId,
      type: "DataTreeNode",

      data: {
        type: 'dashboard',
        headerTitle: dashboard.name + ' Dashboard',
        headerDescription: dashboard.description,
        icon: <LayoutDashboard className="h-4 w-4 shrink-0  __text-gray-500" />,
        children: dashboard.sourceColumns[0].columns.map((column) => {
          return {
            label: column,
            id: `${dashboardId}_${column}`,
            icon: <Columns className="h-4 w-4 shrink-0  __text-gray-500" />
          };
        })

      },
      position: {
        x: 0,
        y: 0
      }
    });

    // Connect source tables to dashboard
    // dashboard.sourceTables.forEach(sourceTablePath => {
    //   const parts = sourceTablePath.split('.');
    //   const tableName = parts[parts.length - 1];

    //   if (tableIds[tableName]) {
    //     edges.push({
    //       id: `e${edgeId++}`,
    //       source: tableIds[tableName],
    //       target: dashboardId,
    //       animated: false
    //     });
    //   }
    // });
  });

  // Deduplicate edges by ID
  const uniqueEdgesMap = new Map();
  edges.forEach(edge => {
    uniqueEdgesMap.set(edge.id, edge);
  });

  // Convert the map values back to array
  const uniqueEdges = Array.from(uniqueEdgesMap.values());

  // Replace the original edges array with the deduplicated version
  // edges.length = 0;
  // uniqueEdges.forEach(edge => edges.push(edge));
  return { nodes, edges: uniqueEdges };
};


export default insuranceSystem;
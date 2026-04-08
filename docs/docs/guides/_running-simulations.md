# Running Simulations

Invana's simulation engine lets you model strategic interactions on your knowledge graph using game theory. Define players, strategies, rules, and parameters, then run simulations to analyze outcomes.

## Simulation Concepts

A simulation in Invana consists of:

| Component      | Description                                    |
|----------------|------------------------------------------------|
| **Players**    | Agents that make decisions (mapped to nodes)   |
| **Strategies** | Available actions for each player              |
| **Rules**      | Logic that determines outcomes from actions    |
| **Parameters** | Configuration values that control behavior     |
| **Payoffs**    | Numerical rewards/costs assigned to outcomes   |

## Creating a Simulation

### Via Studio

1. Navigate to **Simulations → New Simulation**
2. Give it a name and description
3. Define players, strategies, and rules in the visual editor
4. Configure parameters
5. Click **Run**

### Via API

```bash
curl -X POST http://localhost:8000/api/v1/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Market Competition",
    "description": "Two firms competing on price",
    "players": [
      {
        "id": "firm_a",
        "name": "Firm A",
        "node_query": "MATCH (f:Company {name: $name}) RETURN f",
        "node_params": {"name": "Acme Corp"},
        "strategies": ["price_high", "price_low"]
      },
      {
        "id": "firm_b",
        "name": "Firm B",
        "node_query": "MATCH (f:Company {name: $name}) RETURN f",
        "node_params": {"name": "Beta Inc"},
        "strategies": ["price_high", "price_low"]
      }
    ],
    "payoff_matrix": {
      "firm_a": {
        "price_high,price_high": 3,
        "price_high,price_low": 0,
        "price_low,price_high": 5,
        "price_low,price_low": 1
      },
      "firm_b": {
        "price_high,price_high": 3,
        "price_high,price_low": 5,
        "price_low,price_high": 0,
        "price_low,price_low": 1
      }
    },
    "parameters": {
      "rounds": 100,
      "strategy_update": "best_response"
    }
  }'
```

## Payoff Matrices

The payoff matrix defines the reward for each combination of strategies.

### Prisoner's Dilemma Example

|                    | Player B: Cooperate | Player B: Defect |
|--------------------|--------------------:|------------------:|
| **Player A: Cooperate** | (3, 3)              | (0, 5)            |
| **Player A: Defect**    | (5, 0)              | (1, 1)            |

```json
{
  "payoff_matrix": {
    "player_a": {
      "cooperate,cooperate": 3,
      "cooperate,defect": 0,
      "defect,cooperate": 5,
      "defect,defect": 1
    },
    "player_b": {
      "cooperate,cooperate": 3,
      "cooperate,defect": 5,
      "defect,cooperate": 0,
      "defect,defect": 1
    }
  }
}
```

## Strategy Update Rules

Players can update their strategies between rounds using different rules:

| Rule             | Description                                      |
|------------------|--------------------------------------------------|
| `best_response`  | Switch to the strategy with highest expected payoff |
| `imitate_best`   | Copy the strategy of the highest-scoring neighbor  |
| `tit_for_tat`    | Cooperate first, then mirror opponent's last move  |
| `random`         | Choose uniformly at random                        |
| `epsilon_greedy` | Best response with probability 1-ε, random with ε |
| `replicator`     | Probabilistic switch based on payoff differences   |

## Running a Simulation

### Single Run

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/run \
  -H "Content-Type: application/json" \
  -d '{"rounds": 100}'
```

### Parameter Sweep

Run the same simulation across a range of parameter values:

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/sweep \
  -H "Content-Type: application/json" \
  -d '{
    "sweep_params": {
      "epsilon": {"min": 0.0, "max": 1.0, "steps": 11}
    },
    "rounds_per_run": 100,
    "runs_per_config": 10
  }'
```

### Streaming Results

Monitor a simulation in real time via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/simulations/{sim_id}/stream');

ws.send(JSON.stringify({ action: 'start', rounds: 100 }));

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'round':
      console.log(`Round ${msg.round}: ${JSON.stringify(msg.actions)}`);
      break;
    case 'complete':
      console.log('Simulation complete:', msg.summary);
      break;
  }
};
```

## Analyzing Results

### Summary Statistics

```bash
curl http://localhost:8000/api/v1/simulations/{sim_id}/results
```

```json
{
  "simulation_id": "sim-123",
  "total_rounds": 100,
  "players": {
    "firm_a": {
      "total_payoff": 284,
      "avg_payoff": 2.84,
      "strategy_distribution": {"price_high": 0.72, "price_low": 0.28},
      "final_strategy": "price_high"
    },
    "firm_b": {
      "total_payoff": 291,
      "avg_payoff": 2.91,
      "strategy_distribution": {"price_high": 0.68, "price_low": 0.32},
      "final_strategy": "price_high"
    }
  },
  "equilibrium": {
    "type": "nash",
    "strategies": {"firm_a": "price_low", "firm_b": "price_low"},
    "converged_at_round": 67
  }
}
```

### Round-by-Round History

```bash
curl http://localhost:8000/api/v1/simulations/{sim_id}/results/history?from=1&to=10
```

### Hypothesis Testing

Test whether an observed outcome is statistically significant:

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/hypothesis \
  -H "Content-Type: application/json" \
  -d '{
    "hypothesis": "firm_a_avg_payoff > firm_b_avg_payoff",
    "method": "bootstrap",
    "n_samples": 10000,
    "confidence": 0.95
  }'
```

```json
{
  "hypothesis": "firm_a_avg_payoff > firm_b_avg_payoff",
  "result": "reject",
  "p_value": 0.23,
  "confidence_interval": [-0.42, 0.28],
  "method": "bootstrap",
  "n_samples": 10000
}
```

## Multi-Player Simulations

Simulations can involve more than two players. Graph structure determines interactions:

```json
{
  "name": "Network Coordination",
  "players_query": "MATCH (p:Agent) RETURN p",
  "interaction_query": "MATCH (a:Agent)-[:CONNECTED_TO]->(b:Agent) RETURN a, b",
  "strategies": ["adopt", "reject"],
  "payoff_function": "coordination_game",
  "parameters": {
    "rounds": 200,
    "strategy_update": "imitate_best",
    "network_effect_weight": 0.8
  }
}
```

!!! tip "Graph-Driven Interactions"
    Unlike traditional game theory tools, Invana uses your knowledge graph topology to define who interacts with whom. This enables network effects, spatial games, and topology-dependent dynamics.

## Next Steps

- [Simulation Concepts](../concepts/simulations.md) — deep dive into the simulation engine
- [Tic-Tac-Toe Example](tic-tac-toe-example.md) — complete worked example
- [Simulation Dashboard](../studio/simulation-dashboard.md) — visualize results in Studio

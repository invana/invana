# Example: Tic-Tac-Toe Simulation

This end-to-end example models a Tic-Tac-Toe game as a graph-based simulation. It demonstrates ontology design, game state representation, rule definition, and outcome analysis.

## Overview

We'll model Tic-Tac-Toe where:

- The **board** is a graph of 9 cell nodes
- **Players** (X and O) take turns claiming cells
- **Adjacency edges** encode winning lines
- The **simulation engine** runs games with different strategies

## Step 1: Define the Ontology

### Node Types

| Label    | Properties                                      |
|----------|--------------------------------------------------|
| `Cell`   | `position: integer (0-8)`, `state: string (empty/X/O)` |
| `Player` | `symbol: string (X/O)`, `strategy: string`       |
| `Game`   | `status: string`, `winner: string`, `moves: integer` |

### Edge Types

| Label         | Source   | Target   | Description                    |
|---------------|----------|----------|--------------------------------|
| `ADJACENT`    | `Cell`   | `Cell`   | Cells on the same winning line |
| `CLAIMED_BY`  | `Cell`   | `Player` | Player owns this cell          |
| `PLAYS_IN`    | `Player` | `Game`   | Player participates in game    |

## Step 2: Create the Board Graph

```cypher
// Create the 9 cells
UNWIND range(0, 8) AS pos
CREATE (c:Cell {position: pos, state: 'empty'})

// Create winning line adjacencies (rows, columns, diagonals)
// Row 1: 0-1-2
MATCH (a:Cell {position: 0}), (b:Cell {position: 1}), (c:Cell {position: 2})
CREATE (a)-[:ADJACENT {line: 'row1'}]->(b)-[:ADJACENT {line: 'row1'}]->(c)

// Row 2: 3-4-5
MATCH (a:Cell {position: 3}), (b:Cell {position: 4}), (c:Cell {position: 5})
CREATE (a)-[:ADJACENT {line: 'row2'}]->(b)-[:ADJACENT {line: 'row2'}]->(c)

// Row 3: 6-7-8
MATCH (a:Cell {position: 6}), (b:Cell {position: 7}), (c:Cell {position: 8})
CREATE (a)-[:ADJACENT {line: 'row3'}]->(b)-[:ADJACENT {line: 'row3'}]->(c)

// Column 1: 0-3-6
MATCH (a:Cell {position: 0}), (b:Cell {position: 3}), (c:Cell {position: 6})
CREATE (a)-[:ADJACENT {line: 'col1'}]->(b)-[:ADJACENT {line: 'col1'}]->(c)

// Column 2: 1-4-7
MATCH (a:Cell {position: 1}), (b:Cell {position: 4}), (c:Cell {position: 7})
CREATE (a)-[:ADJACENT {line: 'col2'}]->(b)-[:ADJACENT {line: 'col2'}]->(c)

// Column 3: 2-5-8
MATCH (a:Cell {position: 2}), (b:Cell {position: 5}), (c:Cell {position: 8})
CREATE (a)-[:ADJACENT {line: 'col3'}]->(b)-[:ADJACENT {line: 'col3'}]->(c)

// Diagonal 1: 0-4-8
MATCH (a:Cell {position: 0}), (b:Cell {position: 4}), (c:Cell {position: 8})
CREATE (a)-[:ADJACENT {line: 'diag1'}]->(b)-[:ADJACENT {line: 'diag1'}]->(c)

// Diagonal 2: 2-4-6
MATCH (a:Cell {position: 2}), (b:Cell {position: 4}), (c:Cell {position: 6})
CREATE (a)-[:ADJACENT {line: 'diag2'}]->(b)-[:ADJACENT {line: 'diag2'}]->(c)
```

The board graph looks like:

```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

## Step 3: Define Players

```cypher
CREATE (x:Player {symbol: 'X', strategy: 'minimax'})
CREATE (o:Player {symbol: 'O', strategy: 'random'})
```

## Step 4: Configure the Simulation

```bash
curl -X POST http://localhost:8000/api/v1/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tic-Tac-Toe: Minimax vs Random",
    "description": "X plays minimax, O plays random. 1000 games.",
    "game_type": "sequential",
    "players": [
      {
        "id": "player_x",
        "name": "Player X",
        "node_query": "MATCH (p:Player {symbol: $symbol}) RETURN p",
        "node_params": {"symbol": "X"},
        "strategy": "minimax"
      },
      {
        "id": "player_o",
        "name": "Player O",
        "node_query": "MATCH (p:Player {symbol: $symbol}) RETURN p",
        "node_params": {"symbol": "O"},
        "strategy": "random"
      }
    ],
    "board_query": "MATCH (c:Cell) RETURN c ORDER BY c.position",
    "rules": {
      "win_condition": "three_in_a_line",
      "adjacency_query": "MATCH (a:Cell)-[:ADJACENT {line: $line}]->(b:Cell) RETURN a, b",
      "move_action": "claim_cell",
      "turn_order": "alternating"
    },
    "parameters": {
      "games": 1000,
      "first_player": "alternate"
    }
  }'
```

## Step 5: Run the Simulation

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/run
```

### Watch in Real Time

In Studio, open the **Simulation Dashboard** to watch games play out on the graph canvas. Each move highlights the claimed cell and updates the board visualization.

## Step 6: Analyze Results

```bash
curl http://localhost:8000/api/v1/simulations/{sim_id}/results
```

```json
{
  "simulation_id": "sim-ttt-001",
  "total_games": 1000,
  "results": {
    "player_x_wins": 782,
    "player_o_wins": 53,
    "draws": 165,
    "avg_moves_per_game": 6.8
  },
  "strategy_analysis": {
    "player_x": {
      "strategy": "minimax",
      "win_rate": 0.782,
      "avg_moves_to_win": 5.4,
      "most_common_opening": 4
    },
    "player_o": {
      "strategy": "random",
      "win_rate": 0.053,
      "avg_moves_to_win": 7.2,
      "most_common_opening": "uniform"
    }
  }
}
```

## Step 7: Strategy Comparison Sweep

Run the same game with different strategy pairs:

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/sweep \
  -H "Content-Type: application/json" \
  -d '{
    "sweep_params": {
      "player_x_strategy": ["minimax", "random", "center_first", "corner_first"],
      "player_o_strategy": ["minimax", "random", "center_first", "corner_first"]
    },
    "games_per_config": 500
  }'
```

### Sweep Results

| X Strategy     | O Strategy     | X Wins | O Wins | Draws |
|----------------|----------------|--------|--------|-------|
| minimax        | random         | 78.2%  | 5.3%   | 16.5% |
| minimax        | minimax        | 0%     | 0%     | 100%  |
| random         | random         | 58.4%  | 28.8%  | 12.8% |
| center_first   | corner_first   | 61.2%  | 18.6%  | 20.2% |

!!! note "Minimax vs Minimax"
    When both players use the optimal minimax strategy, every game ends in a draw — confirming that Tic-Tac-Toe is a solved game.

## Step 8: Hypothesis Test

Test the hypothesis that minimax is significantly better than random:

```bash
curl -X POST http://localhost:8000/api/v1/simulations/{sim_id}/hypothesis \
  -H "Content-Type: application/json" \
  -d '{
    "hypothesis": "minimax_win_rate > random_win_rate",
    "method": "bootstrap",
    "n_samples": 10000,
    "confidence": 0.99
  }'
```

```json
{
  "hypothesis": "minimax_win_rate > random_win_rate",
  "result": "accept",
  "p_value": 0.0001,
  "effect_size": 0.729,
  "confidence_interval": [0.68, 0.77],
  "interpretation": "Minimax strategy significantly outperforms random strategy (p < 0.001)"
}
```

## What You've Learned

1. **Graph-based game modelling** — representing a game board as a knowledge graph
2. **Ontology design** — choosing node types, edge types, and properties for a game domain
3. **Simulation configuration** — defining players, strategies, rules, and parameters
4. **Strategy comparison** — using parameter sweeps to evaluate different approaches
5. **Statistical validation** — using hypothesis testing to confirm results

## Next Steps

- [Running Simulations](running-simulations.md) — more simulation patterns
- [Algorithms](../concepts/algorithms.md) — graph algorithms for analysis
- [Simulation Dashboard](../studio/simulation-dashboard.md) — visualization and monitoring

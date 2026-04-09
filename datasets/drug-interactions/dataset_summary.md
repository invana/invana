# Drug Interaction Dataset Summary

Generated on: 2025-10-01 01:55:04

## Node Statistics

- **Drugs**: 500 nodes
- **Targets**: 200 nodes
- **Diseases**: 150 nodes
- **Pathways**: 100 nodes
- **Compounds**: 300 nodes
- **Mechanisms**: 80 nodes

**Total Nodes**: 1,330

## Relationship Statistics

- **drug_treats**: 600 relationships
- **pathway_regulates**: 298 relationships
- **compound_similar_to**: 496 relationships
- **target_involved_in**: 400 relationships
- **mechanism_causes**: 200 relationships
- **drug_targets**: 800 relationships

**Total Relationships**: 2,794

## CSV Format Standards

### Nodes Format
```csv
Id,Label,Properties:name,Properties:description,Properties:type,Properties:source,Properties:confidence
```

### Relationships Format
```csv
Id,Label,FromId,ToId,Properties:strength,Properties:evidence,Properties:confidence,Properties:source
```

## Files Generated

### Node Files
- `nodes/diseases.csv`
- `nodes/compounds.csv`
- `nodes/pathways.csv`
- `nodes/drugs.csv`
- `nodes/mechanisms.csv`
- `nodes/targets.csv`

### Relationship Files
- `relationships/drug_treats.csv`
- `relationships/pathway_regulates.csv`
- `relationships/compound_similar_to.csv`
- `relationships/target_involved_in.csv`
- `relationships/mechanism_causes.csv`
- `relationships/drug_targets.csv`

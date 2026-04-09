#!/usr/bin/env python3
"""
Invana Drug Interaction Dataset Generator

This script generates a comprehensive pharmaceutical dataset following Invana's
gold standard CSV format. The dataset includes realistic drug interaction data
suitable for graph database loading and analysis.

Dataset Structure:
- 500 FDA-approved drugs
- 200 protein targets
- 150 diseases/conditions
- 100 biological pathways
- 300 chemical compounds
- 80 mechanism of action categories

Generated Files:
- nodes/drugs.csv (500 entries)
- nodes/targets.csv (200 entries)
- nodes/diseases.csv (150 entries)
- nodes/pathways.csv (100 entries)
- nodes/compounds.csv (300 entries)
- nodes/mechanisms.csv (80 entries)
- relationships/drug_targets.csv (~400 entries)
- relationships/drug_treats.csv (~300 entries)
- relationships/compound_pathways.csv (~200 entries)
- relationships/target_pathways.csv (~250 entries)
- relationships/drug_mechanisms.csv (~350 entries)
- relationships/compound_structures.csv (~400 entries)

Usage:
    python generate_dataset.py
"""

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path


class DrugDatasetGenerator:
    """Generates comprehensive pharmaceutical dataset for Invana graph databases."""

    def __init__(self, base_path: str = None):
        """Initialize the generator with output paths."""
        if base_path is None:
            base_path = str(Path(__file__).parent)

        self.base_path = Path(base_path)
        self.nodes_dir = self.base_path / "nodes"
        self.relationships_dir = self.base_path / "relationships"

        # Create directories
        self.nodes_dir.mkdir(exist_ok=True)
        self.relationships_dir.mkdir(exist_ok=True)

        # Initialize data collections
        self.drugs = []
        self.targets = []
        self.diseases = []
        self.pathways = []
        self.compounds = []
        self.mechanisms = []

        # Relationship collections
        self.drug_targets = []
        self.drug_treats = []
        self.compound_pathways = []
        self.target_pathways = []
        self.drug_mechanisms = []
        self.compound_structures = []

    def generate_nodes(self):
        """Generate all node types with realistic pharmaceutical data."""
        print("🔬 Generating pharmaceutical nodes...")

        # Generate 500 FDA-approved drugs
        drug_names = [
            "Aspirin",
            "Ibuprofen",
            "Acetaminophen",
            "Lisinopril",
            "Atorvastatin",
            "Metformin",
            "Amlodipine",
            "Metoprolol",
            "Omeprazole",
            "Simvastatin",
            "Hydrochlorothiazide",
            "Losartan",
            "Azithromycin",
            "Furosemide",
            "Albuterol",
            "Prednisone",
            "Tramadol",
            "Cephalexin",
            "Amoxicillin",
            "Warfarin",
            "Levothyroxine",
            "Ciprofloxacin",
            "Clonazepam",
            "Lorazepam",
            "Zolpidem",
            "Sertraline",
            "Fluoxetine",
            "Paroxetine",
            "Escitalopram",
            "Venlafaxine",
            "Duloxetine",
            "Bupropion",
            "Mirtazapine",
            "Trazodone",
            "Alprazolam",
            "Gabapentin",
            "Pregabalin",
            "Morphine",
            "Oxycodone",
            "Fentanyl",
            "Codeine",
            "Hydrocodone",
            "Tramadol",
            "Meloxicam",
            "Diclofenac",
            "Naproxen",
            "Celecoxib",
            "Indomethacin",
            "Ketorolac",
            "Piroxicam",
        ]

        drug_types = [
            "NSAID",
            "ACE_INHIBITOR",
            "STATIN",
            "DIURETIC",
            "BETA_BLOCKER",
            "PROTON_PUMP_INHIBITOR",
            "ANTIBIOTIC",
            "ANTIDEPRESSANT",
            "ANXIOLYTIC",
            "HYPNOTIC",
            "ANTICONVULSANT",
            "OPIOID",
            "BRONCHODILATOR",
            "CORTICOSTEROID",
        ]

        for i in range(500):
            base_name = random.choice(drug_names) if i < len(drug_names) else f"Drug_{i+1:03d}"
            drug_id = f"DRUG_{i+1:05d}"

            self.drugs.append(
                {
                    "Id": drug_id,
                    "Label": "Drug",
                    "Properties:name": f"{base_name}_{i+1}" if i >= len(drug_names) else base_name,
                    "Properties:brandName": self._generate_brand_name(),
                    "Properties:type": random.choice(drug_types),
                    "Properties:fdaApproved": random.choice([True, False]),
                    "Properties:molecularWeight": round(random.uniform(150.0, 800.0), 2),
                    "Properties:dosageForm": random.choice(["tablet", "capsule", "injection", "syrup", "cream"]),
                    "Properties:dosageMg": random.randint(5, 500),
                    "Properties:manufacturer": self._generate_manufacturer(),
                    "Properties:approvalDate": self._generate_date(),
                    "Properties:indication": self._generate_indication(),
                    "Properties:contraindications": self._generate_contraindications(),
                    "Properties:sideEffects": self._generate_side_effects(),
                    "Properties:source": "FDA_ORANGE_BOOK",
                    "Properties:confidence": round(random.uniform(0.85, 0.99), 3),
                }
            )

        # Generate 200 protein targets
        target_families = [
            "KINASE",
            "GPCR",
            "ION_CHANNEL",
            "NUCLEAR_RECEPTOR",
            "ENZYME",
            "TRANSPORTER",
            "STRUCTURAL_PROTEIN",
            "CYTOKINE",
            "HORMONE",
        ]

        for i in range(200):
            target_id = f"TARGET_{i+1:05d}"
            self.targets.append(
                {
                    "Id": target_id,
                    "Label": "Target",
                    "Properties:name": f"Protein_Target_{i+1:03d}",
                    "Properties:uniprotId": f"P{random.randint(10000, 99999)}",
                    "Properties:family": random.choice(target_families),
                    "Properties:chromosome": f"chr{random.randint(1, 22)}",
                    "Properties:geneSymbol": f"GENE{random.randint(100, 999)}",
                    "Properties:organism": "Homo sapiens",
                    "Properties:tissueSpecificity": random.choice(
                        ["brain", "liver", "kidney", "heart", "lung", "muscle"]
                    ),
                    "Properties:molecularFunction": self._generate_molecular_function(),
                    "Properties:cellularLocation": random.choice(["membrane", "cytoplasm", "nucleus", "mitochondria"]),
                    "Properties:expression": random.choice(["high", "medium", "low"]),
                    "Properties:source": "UNIPROT",
                    "Properties:confidence": round(random.uniform(0.80, 0.95), 3),
                }
            )

        # Generate 150 diseases
        disease_categories = [
            "CARDIOVASCULAR",
            "NEUROLOGICAL",
            "METABOLIC",
            "INFECTIOUS",
            "ONCOLOGY",
            "RESPIRATORY",
            "GASTROINTESTINAL",
            "PSYCHIATRIC",
        ]

        disease_names = [
            "Hypertension",
            "Diabetes",
            "Depression",
            "Anxiety",
            "Asthma",
            "COPD",
            "Heart_Failure",
            "Stroke",
            "Alzheimers",
            "Parkinsons",
            "Cancer",
            "Pneumonia",
            "Bronchitis",
            "Gastritis",
            "Ulcer",
            "Arthritis",
            "Osteoporosis",
            "Migraine",
            "Epilepsy",
            "Schizophrenia",
            "Bipolar_Disorder",
            "Insomnia",
            "Obesity",
            "Hyperlipidemia",
            "Atrial_Fibrillation",
            "Angina",
            "Myocardial_Infarction",
        ]

        for i in range(150):
            disease_id = f"DISEASE_{i+1:05d}"
            base_name = random.choice(disease_names) if i < len(disease_names) else f"Disease_{i+1:03d}"

            self.diseases.append(
                {
                    "Id": disease_id,
                    "Label": "Disease",
                    "Properties:name": f"{base_name}_{i+1}" if i >= len(disease_names) else base_name,
                    "Properties:icdCode": f"{random.choice(['I', 'E', 'F', 'J', 'K'])}{random.randint(10,99)}.{random.randint(0,9)}",
                    "Properties:category": random.choice(disease_categories),
                    "Properties:prevalence": round(random.uniform(0.01, 15.0), 2),
                    "Properties:mortality": round(random.uniform(0.0, 5.0), 2),
                    "Properties:severity": random.choice(["mild", "moderate", "severe"]),
                    "Properties:chronicStatus": random.choice(["acute", "chronic"]),
                    "Properties:symptoms": self._generate_symptoms(),
                    "Properties:riskFactors": self._generate_risk_factors(),
                    "Properties:source": "ICD10",
                    "Properties:confidence": round(random.uniform(0.90, 0.99), 3),
                }
            )

        # Generate 100 biological pathways
        pathway_types = [
            "METABOLIC",
            "SIGNALING",
            "IMMUNE",
            "CELL_CYCLE",
            "APOPTOSIS",
            "DNA_REPAIR",
            "PROTEIN_SYNTHESIS",
            "LIPID_METABOLISM",
        ]

        for i in range(100):
            pathway_id = f"PATHWAY_{i+1:05d}"
            self.pathways.append(
                {
                    "Id": pathway_id,
                    "Label": "Pathway",
                    "Properties:name": f"Biological_Pathway_{i+1:03d}",
                    "Properties:keggId": f"hsa{random.randint(10000, 99999)}",
                    "Properties:type": random.choice(pathway_types),
                    "Properties:description": self._generate_pathway_description(),
                    "Properties:geneCount": random.randint(5, 200),
                    "Properties:significance": round(random.uniform(0.001, 0.05), 6),
                    "Properties:enrichmentScore": round(random.uniform(1.5, 10.0), 2),
                    "Properties:cellType": random.choice(["hepatocyte", "neuron", "cardiomyocyte", "fibroblast"]),
                    "Properties:source": "KEGG",
                    "Properties:confidence": round(random.uniform(0.75, 0.95), 3),
                }
            )

        # Generate 300 chemical compounds
        compound_types = [
            "SMALL_MOLECULE",
            "PEPTIDE",
            "NUCLEOTIDE",
            "LIPID",
            "CARBOHYDRATE",
            "ALKALOID",
            "STEROID",
            "FLAVONOID",
        ]

        for i in range(300):
            compound_id = f"COMPOUND_{i+1:05d}"
            self.compounds.append(
                {
                    "Id": compound_id,
                    "Label": "Compound",
                    "Properties:name": f"Chemical_Compound_{i+1:03d}",
                    "Properties:pubchemId": f"CID{random.randint(100000, 999999)}",
                    "Properties:chemblId": f"CHEMBL{random.randint(100000, 999999)}",
                    "Properties:smiles": self._generate_smiles(),
                    "Properties:inchiKey": self._generate_inchi_key(),
                    "Properties:type": random.choice(compound_types),
                    "Properties:molecularFormula": self._generate_molecular_formula(),
                    "Properties:exactMass": round(random.uniform(100.0, 1000.0), 4),
                    "Properties:logP": round(random.uniform(-2.0, 8.0), 2),
                    "Properties:hbd": random.randint(0, 10),
                    "Properties:hba": random.randint(0, 15),
                    "Properties:rotatablebonds": random.randint(0, 20),
                    "Properties:polarSurfaceArea": round(random.uniform(20.0, 200.0), 2),
                    "Properties:bioavailability": round(random.uniform(0.1, 1.0), 2),
                    "Properties:source": "PUBCHEM",
                    "Properties:confidence": round(random.uniform(0.80, 0.98), 3),
                }
            )

        # Generate 80 mechanism categories
        moa_types = [
            "ENZYME_INHIBITION",
            "RECEPTOR_AGONIST",
            "RECEPTOR_ANTAGONIST",
            "CHANNEL_BLOCKER",
            "TRANSPORTER_INHIBITION",
            "PROTEIN_BINDING",
            "DNA_INTERACTION",
            "RNA_INTERFERENCE",
        ]

        for i in range(80):
            mechanism_id = f"MECHANISM_{i+1:05d}"
            self.mechanisms.append(
                {
                    "Id": mechanism_id,
                    "Label": "Mechanism",
                    "Properties:name": f"Mechanism_of_Action_{i+1:02d}",
                    "Properties:type": random.choice(moa_types),
                    "Properties:description": self._generate_mechanism_description(),
                    "Properties:targetClass": random.choice(["enzyme", "receptor", "channel", "transporter"]),
                    "Properties:reversibility": random.choice(["reversible", "irreversible", "competitive"]),
                    "Properties:specificity": round(random.uniform(0.1, 1.0), 2),
                    "Properties:potency": round(random.uniform(0.01, 100.0), 3),
                    "Properties:selectivity": round(random.uniform(1.0, 1000.0), 1),
                    "Properties:source": "CHEMBL",
                    "Properties:confidence": round(random.uniform(0.70, 0.95), 3),
                }
            )

        print(f"   ✅ Generated {len(self.drugs)} drugs")
        print(f"   ✅ Generated {len(self.targets)} targets")
        print(f"   ✅ Generated {len(self.diseases)} diseases")
        print(f"   ✅ Generated {len(self.pathways)} pathways")
        print(f"   ✅ Generated {len(self.compounds)} compounds")
        print(f"   ✅ Generated {len(self.mechanisms)} mechanisms")

    def generate_relationships(self):
        """Generate realistic relationships between nodes."""
        print("🔗 Generating pharmaceutical relationships...")

        # Drug-Target interactions (~400 relationships)
        for i in range(400):
            drug = random.choice(self.drugs)
            target = random.choice(self.targets)

            self.drug_targets.append(
                {
                    "Id": f"DRUG_TARGET_{i+1:05d}",
                    "Label": "DrugTargets",
                    "FromId": drug["Id"],
                    "ToId": target["Id"],
                    "Properties:affinity": round(random.uniform(0.1, 10.0), 3),
                    "Properties:ic50": round(random.uniform(0.001, 100.0), 6),
                    "Properties:ki": round(random.uniform(0.001, 50.0), 6),
                    "Properties:mechanism": random.choice(["inhibition", "activation", "binding", "modulation"]),
                    "Properties:evidence": random.choice(["experimental", "computational", "literature"]),
                    "Properties:assayType": random.choice(["biochemical", "cellular", "tissue"]),
                    "Properties:species": "human",
                    "Properties:confidence": round(random.uniform(0.60, 0.95), 3),
                    "Properties:source": "CHEMBL",
                }
            )

        # Drug-Disease treatments (~300 relationships)
        for i in range(300):
            drug = random.choice(self.drugs)
            disease = random.choice(self.diseases)

            self.drug_treats.append(
                {
                    "Id": f"DRUG_TREATS_{i+1:05d}",
                    "Label": "DrugTreats",
                    "FromId": drug["Id"],
                    "ToId": disease["Id"],
                    "Properties:efficacy": round(random.uniform(0.3, 0.95), 3),
                    "Properties:sideEffectProfile": random.choice(["mild", "moderate", "severe"]),
                    "Properties:dosage": f"{random.randint(5, 500)}mg",
                    "Properties:frequency": random.choice(
                        ["once_daily", "twice_daily", "three_times_daily", "as_needed"]
                    ),
                    "Properties:duration": f"{random.randint(1, 52)} weeks",
                    "Properties:route": random.choice(["oral", "intravenous", "topical", "intramuscular"]),
                    "Properties:indication": random.choice(["primary", "secondary", "off_label"]),
                    "Properties:evidence": random.choice(["Phase_III", "Phase_II", "real_world", "case_study"]),
                    "Properties:confidence": round(random.uniform(0.70, 0.98), 3),
                    "Properties:source": "CLINICAL_TRIALS",
                }
            )

        # Compound-Pathway interactions (~200 relationships)
        for i in range(200):
            compound = random.choice(self.compounds)
            pathway = random.choice(self.pathways)

            self.compound_pathways.append(
                {
                    "Id": f"COMPOUND_PATHWAY_{i+1:05d}",
                    "Label": "CompoundAffectsPathway",
                    "FromId": compound["Id"],
                    "ToId": pathway["Id"],
                    "Properties:effect": random.choice(["activation", "inhibition", "modulation"]),
                    "Properties:strength": round(random.uniform(0.1, 1.0), 3),
                    "Properties:pValue": round(random.uniform(0.001, 0.05), 6),
                    "Properties:foldChange": round(random.uniform(0.5, 3.0), 2),
                    "Properties:regulation": random.choice(["upregulation", "downregulation", "mixed"]),
                    "Properties:timepoint": f"{random.randint(1, 72)} hours",
                    "Properties:cellLine": random.choice(["HepG2", "MCF7", "A549", "HEK293"]),
                    "Properties:confidence": round(random.uniform(0.65, 0.90), 3),
                    "Properties:source": "PATHWAY_ANALYSIS",
                }
            )

        # Target-Pathway associations (~250 relationships)
        for i in range(250):
            target = random.choice(self.targets)
            pathway = random.choice(self.pathways)

            self.target_pathways.append(
                {
                    "Id": f"TARGET_PATHWAY_{i+1:05d}",
                    "Label": "TargetInvolvedInPathway",
                    "FromId": target["Id"],
                    "ToId": pathway["Id"],
                    "Properties:role": random.choice(["enzyme", "substrate", "regulator", "cofactor"]),
                    "Properties:importance": round(random.uniform(0.1, 1.0), 3),
                    "Properties:essentiality": random.choice(["essential", "important", "moderate", "minor"]),
                    "Properties:position": random.choice(["upstream", "downstream", "central", "peripheral"]),
                    "Properties:expression": round(random.uniform(0.1, 10.0), 2),
                    "Properties:activity": round(random.uniform(0.0, 100.0), 1),
                    "Properties:confidence": round(random.uniform(0.70, 0.95), 3),
                    "Properties:source": "PATHWAY_DB",
                }
            )

        # Drug-Mechanism relationships (~350 relationships)
        for i in range(350):
            drug = random.choice(self.drugs)
            mechanism = random.choice(self.mechanisms)

            self.drug_mechanisms.append(
                {
                    "Id": f"DRUG_MECHANISM_{i+1:05d}",
                    "Label": "DrugHasMechanism",
                    "FromId": drug["Id"],
                    "ToId": mechanism["Id"],
                    "Properties:primary": random.choice([True, False]),
                    "Properties:potency": round(random.uniform(0.01, 100.0), 3),
                    "Properties:selectivity": round(random.uniform(1.0, 1000.0), 1),
                    "Properties:kinetics": random.choice(["fast", "slow", "intermediate"]),
                    "Properties:reversibility": random.choice(["reversible", "irreversible"]),
                    "Properties:allosteric": random.choice([True, False]),
                    "Properties:cooperativity": round(random.uniform(0.5, 2.0), 2),
                    "Properties:evidence": random.choice(["biochemical", "structural", "computational"]),
                    "Properties:confidence": round(random.uniform(0.60, 0.90), 3),
                    "Properties:source": "MOA_DB",
                }
            )

        # Compound-Structure relationships (~400 relationships)
        for i in range(400):
            compound1 = random.choice(self.compounds)
            compound2 = random.choice(self.compounds)

            if compound1["Id"] != compound2["Id"]:  # Avoid self-relationships
                self.compound_structures.append(
                    {
                        "Id": f"COMPOUND_SIMILARITY_{i+1:05d}",
                        "Label": "StructuralSimilarity",
                        "FromId": compound1["Id"],
                        "ToId": compound2["Id"],
                        "Properties:tanimoto": round(random.uniform(0.3, 0.95), 3),
                        "Properties:dice": round(random.uniform(0.3, 0.95), 3),
                        "Properties:cosine": round(random.uniform(0.3, 0.95), 3),
                        "Properties:fingerprint": random.choice(["ECFP4", "MACCS", "FCFP6", "RDKit"]),
                        "Properties:scaffold": random.choice(["same", "similar", "different"]),
                        "Properties:pharmacophore": round(random.uniform(0.2, 0.9), 3),
                        "Properties:confidence": round(random.uniform(0.75, 0.98), 3),
                        "Properties:source": "SIMILARITY_CALC",
                    }
                )

        print(f"   ✅ Generated {len(self.drug_targets)} drug-target interactions")
        print(f"   ✅ Generated {len(self.drug_treats)} drug-disease treatments")
        print(f"   ✅ Generated {len(self.compound_pathways)} compound-pathway effects")
        print(f"   ✅ Generated {len(self.target_pathways)} target-pathway associations")
        print(f"   ✅ Generated {len(self.drug_mechanisms)} drug-mechanism relationships")
        print(f"   ✅ Generated {len(self.compound_structures)} compound similarities")

    def write_csv_files(self):
        """Write all generated data to CSV files in Invana gold standard format."""
        print("💾 Writing CSV files...")

        # Write node files
        node_files = {
            "drugs.csv": self.drugs,
            "targets.csv": self.targets,
            "diseases.csv": self.diseases,
            "pathways.csv": self.pathways,
            "compounds.csv": self.compounds,
            "mechanisms.csv": self.mechanisms,
        }

        for filename, data in node_files.items():
            if data:
                filepath = self.nodes_dir / filename
                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
                print(f"   ✅ {filepath} ({len(data)} entries)")

        # Write relationship files
        relationship_files = {
            "drug_targets.csv": self.drug_targets,
            "drug_treats.csv": self.drug_treats,
            "compound_pathways.csv": self.compound_pathways,
            "target_pathways.csv": self.target_pathways,
            "drug_mechanisms.csv": self.drug_mechanisms,
            "compound_structures.csv": self.compound_structures,
        }

        for filename, data in relationship_files.items():
            if data:
                filepath = self.relationships_dir / filename
                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
                print(f"   ✅ {filepath} ({len(data)} entries)")

    def generate_complete_dataset(self):
        """Generate the complete pharmaceutical dataset."""
        print("🚀 Generating Invana Gold Standard Drug Interaction Dataset")
        print("=" * 65)

        self.generate_nodes()
        self.generate_relationships()
        self.write_csv_files()

        # Calculate totals
        total_nodes = (
            len(self.drugs)
            + len(self.targets)
            + len(self.diseases)
            + len(self.pathways)
            + len(self.compounds)
            + len(self.mechanisms)
        )
        total_relationships = (
            len(self.drug_targets)
            + len(self.drug_treats)
            + len(self.compound_pathways)
            + len(self.target_pathways)
            + len(self.drug_mechanisms)
            + len(self.compound_structures)
        )

        print("\n📊 Dataset Summary:")
        print(f"   Total Nodes: {total_nodes:,}")
        print(f"   Total Relationships: {total_relationships:,}")
        print(f"   Output Directory: {self.base_path}")
        print("\n✅ Dataset generation complete!")
        print("\n🔍 To load this data:")
        print("   python load_csv_data.py")
        print("   # OR use GremlinCSVLoader")

    # Helper methods for generating realistic data
    def _generate_brand_name(self) -> str:
        prefixes = ["Neo", "Pro", "Max", "Ultra", "Bio", "Vita", "Med", "Pharma", "Gen", "Novo"]
        suffixes = ["ol", "ine", "ex", "max", "plus", "forte", "SR", "XR", "ER", "LA"]
        return f"{random.choice(prefixes)}{random.choice(suffixes)}"

    def _generate_manufacturer(self) -> str:
        companies = [
            "Pfizer",
            "Johnson & Johnson",
            "Roche",
            "Novartis",
            "Merck",
            "Bristol Myers Squibb",
            "AbbVie",
            "GlaxoSmithKline",
            "Sanofi",
            "Amgen",
        ]
        return random.choice(companies)

    def _generate_date(self) -> str:
        start_date = datetime(1990, 1, 1)
        end_date = datetime(2023, 12, 31)
        random_date = start_date + timedelta(seconds=random.randint(0, int((end_date - start_date).total_seconds())))
        return random_date.strftime("%Y-%m-%d")

    def _generate_indication(self) -> str:
        indications = [
            "pain relief",
            "blood pressure control",
            "cholesterol management",
            "diabetes treatment",
            "anxiety reduction",
            "depression treatment",
            "infection control",
            "inflammation reduction",
            "cardiac protection",
        ]
        return random.choice(indications)

    def _generate_contraindications(self) -> str:
        contraindications = [
            "pregnancy",
            "liver disease",
            "kidney impairment",
            "heart failure",
            "bleeding disorders",
            "allergy history",
        ]
        selected = random.sample(contraindications, random.randint(1, 3))
        return "; ".join(selected)

    def _generate_side_effects(self) -> str:
        effects = [
            "nausea",
            "dizziness",
            "headache",
            "fatigue",
            "dry mouth",
            "constipation",
            "diarrhea",
            "rash",
            "drowsiness",
            "insomnia",
        ]
        selected = random.sample(effects, random.randint(2, 5))
        return "; ".join(selected)

    def _generate_molecular_function(self) -> str:
        functions = [
            "protein kinase activity",
            "DNA binding",
            "enzyme activity",
            "receptor binding",
            "transporter activity",
            "structural molecule activity",
        ]
        return random.choice(functions)

    def _generate_symptoms(self) -> str:
        symptoms = [
            "chest pain",
            "shortness of breath",
            "fatigue",
            "nausea",
            "headache",
            "dizziness",
            "fever",
            "cough",
            "abdominal pain",
        ]
        selected = random.sample(symptoms, random.randint(2, 4))
        return "; ".join(selected)

    def _generate_risk_factors(self) -> str:
        factors = [
            "smoking",
            "obesity",
            "family history",
            "age",
            "hypertension",
            "diabetes",
            "sedentary lifestyle",
            "poor diet",
            "stress",
        ]
        selected = random.sample(factors, random.randint(2, 4))
        return "; ".join(selected)

    def _generate_pathway_description(self) -> str:
        descriptions = [
            "Regulates cellular metabolism and energy production",
            "Controls cell cycle progression and division",
            "Mediates immune response and inflammation",
            "Manages protein synthesis and degradation",
            "Coordinates DNA repair and genome stability",
            "Regulates lipid metabolism and storage",
            "Controls apoptosis and cell survival",
            "Mediates signal transduction pathways",
        ]
        return random.choice(descriptions)

    def _generate_smiles(self) -> str:
        # Simplified SMILES generation for demonstration
        fragments = ["C", "CC", "CCC", "c1ccccc1", "CCO", "CCN", "C=O", "C(=O)O"]
        return "".join(random.choices(fragments, k=random.randint(2, 5)))

    def _generate_inchi_key(self) -> str:
        # Generate realistic InChI Key format
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        part1 = "".join(random.choices(chars, k=14))
        part2 = "".join(random.choices(chars, k=10))
        part3 = "".join(random.choices(chars, k=1))
        return f"{part1}-{part2}-{part3}"

    def _generate_molecular_formula(self) -> str:
        elements = [
            f"C{random.randint(5, 30)}",
            f"H{random.randint(8, 60)}",
            f"N{random.randint(0, 8)}" if random.random() > 0.3 else "",
            f"O{random.randint(0, 10)}" if random.random() > 0.2 else "",
            f"S{random.randint(0, 2)}" if random.random() > 0.8 else "",
            f"Cl{random.randint(0, 3)}" if random.random() > 0.7 else "",
        ]
        return "".join([e for e in elements if e])

    def _generate_mechanism_description(self) -> str:
        descriptions = [
            "Competitive inhibition of target enzyme active site",
            "Allosteric modulation of receptor conformation",
            "Irreversible binding to protein cysteine residues",
            "Competitive antagonism of neurotransmitter receptors",
            "Non-competitive inhibition through allosteric binding",
            "Agonistic activation of G-protein coupled receptors",
            "Selective blocking of ion channel conductance",
            "Inhibition of protein-protein interactions",
        ]
        return random.choice(descriptions)


def main():
    """Main execution function."""
    generator = DrugDatasetGenerator()
    generator.generate_complete_dataset()


if __name__ == "__main__":
    main()

create.sql -> creates sql tables of relations defined in milestone 2 schema. Two additional tables were created to encompass drug data ad drug0drug interaction data outlined in milestone 1.

load.sql -> bulk loading file for data in cs project. Data is sourced from multiple csv files denoted below. 

CSV sources:

Synthea data source for Mock Patient Data: https://synthea.mitre.org/

Kaggle Medicine Dataset for Medicine Data: https://www.kaggle.com/datasets/ujjwalaggarwal402/medicine-dataset

Kaggle Drug-Drug Interaction Data: https://www.kaggle.com/datasets/mghobashy/drug-drug-interactions


CSV files in folder:

db_drug_interactions.csv -> drug-drug interaction table
encounters.csv -> encounters table
medicine_dataset -> medicine table
observations.csv -> observations table
patients.csv -> patients table
providers.csv -> providers table


5 staff users were hand generated in the load.sql table. Additionally the provider specialties were randomly generated with python. Pre-processing was done with python. 

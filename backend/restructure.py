import pandas as pd

# Load the existing CSV
input_file = "restructured_labels.csv"
df = pd.read_csv(input_file)

# Extract unique labels and sort them
unique_labels = sorted(df['label'].unique())

# Create a mapping from index to label
index_label_df = pd.DataFrame({
    'index': range(len(unique_labels)),
    'label': unique_labels
})

# Save the new mapping to a CSV file
output_file = "label_index_mapping.csv"
index_label_df.to_csv(output_file, index=False)

print(f"Label index mapping saved to {output_file}")

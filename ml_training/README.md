# Book Categorization ML Model Training

This directory contains the Python pipeline to download the CMU Book Summary Dataset, compile sample Open Library queries, train a Multi-Layer Perceptron (MLP) neural network, and export a quantized model compatible with TensorFlow.js.

## Requirements

Ensure Python 3.10+ is installed on your computer.

Install dependencies using `pip`:
```bash
pip install -r requirements.txt
```

## Running Training

To run the full dataset download, label mapping, model training, threshold tuning, and TF.js quantization pipeline, execute:

```bash
python train.py
```

## Output Artifacts

The script automatically generates and places the following files in the webapp's `public/` directory:

1. `public/models/tagger/` — The TensorFlow.js quantized model shards and `model.json` schema.
2. `public/models/vocab.json` — Vocabulary mappings from the TF-IDF vectorizer (`feature -> index`).
3. `public/models/idf.json` — Calculated Inverse Document Frequency weights for standardizing text inputs.
4. `public/models/thresholds.json` — Custom sigmoid probability thresholds for each of the 68 labels.

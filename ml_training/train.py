import os
import tarfile
import urllib.request
import json
import pandas as pd
import numpy as np
import requests
from tqdm import tqdm
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.metrics import f1_score
import tensorflow as tf
from tensorflow import keras

# Define the taxonomy mapping (matches src/ml/taxonomy.ts)
TAXONOMY = {
  'mood': [
    'Cozy', 'Dark & Gritty', 'Melancholic', 'Uplifting', 'Tense & Thrilling',
    'Whimsical', 'Thought-Provoking', 'Heartwarming', 'Chilling', 'Adventurous',
    'Romantic', 'Funny & Witty', 'Emotionally Heavy', 'Light & Breezy', 'Nostalgic'
  ],
  'pace': ['Slow Burn', 'Fast-Paced', 'Balanced', 'Episodic'],
  'setting': [
    'Contemporary', 'Historical', 'Futuristic', 'Fantasy World', 'Rural', 'Urban',
    'Space', 'Ocean', 'Post-Apocalyptic', 'Alternate History', 'Mythological'
  ],
  'theme': [
    'Coming of Age', 'Identity & Self-Discovery', 'Power & Politics', 'Survival',
    'Love & Relationships', 'Family Dynamics', 'Friendship', 'Grief & Loss',
    'Morality & Ethics', 'Nature & Environment', 'War & Conflict',
    'Technology & Society', 'Religion & Faith', 'Class & Inequality',
    'Mental Health', 'Art & Creativity', 'Crime & Justice', 'Redemption'
  ],
  'genre': [
    'Literary Fiction', 'Science Fiction', 'Fantasy', 'Horror', 'Mystery',
    'Thriller', 'Romance', 'Historical Fiction', 'Contemporary Fiction',
    'Non-Fiction', 'Biography', 'Self-Help', 'Philosophy', 'Poetry',
    'Graphic Novel', 'Young Adult', 'Children\'s', 'Short Stories', 'Essays', 'Classics'
  ]
}

ALL_TAGS = []
for cat in TAXONOMY:
  ALL_TAGS.extend(TAXONOMY[cat])

# Sub-keyword mapping dictionary to map raw CMU/OpenLibrary genres to our taxonomy
LABEL_MAP = {
  # Genres
  'Science Fiction': ['science fiction', 'sci-fi', 'space opera', 'cyberpunk', 'futuristic fiction', 'time travel'],
  'Fantasy': ['fantasy', 'high fantasy', 'epic fantasy', 'magical realism', 'sword and sorcery', 'urban fantasy'],
  'Horror': ['horror', 'gothic fiction', 'ghost story', 'vampire', 'paranormal', 'supernatural'],
  'Mystery': ['mystery', 'detective', 'whodunit', 'crime fiction', 'cozy mystery'],
  'Thriller': ['thriller', 'suspense', 'psychological thriller', 'action', 'adventure thriller'],
  'Romance': ['romance', 'romantic', 'love story', 'chick lit'],
  'Historical Fiction': ['historical fiction', 'historical novel', 'history fiction'],
  'Contemporary Fiction': ['contemporary fiction', 'contemporary', 'realistic fiction'],
  'Non-Fiction': ['non-fiction', 'nonfiction', 'biography', 'memoir', 'history', 'science', 'essays'],
  'Biography': ['biography', 'memoir', 'autobiography'],
  'Self-Help': ['self-help', 'self help', 'inspiration', 'personal growth'],
  'Philosophy': ['philosophy', 'philosophical'],
  'Poetry': ['poetry', 'poem', 'verse'],
  'Graphic Novel': ['graphic novel', 'comic', 'manga'],
  'Young Adult': ['young adult', 'ya', 'teen'],
  'Children\'s': ['children', "children's book", 'juvenile', 'picture book'],
  'Short Stories': ['short stories', 'short story collection', 'anthology'],
  'Essays': ['essays', 'essay'],
  'Classics': ['classic', 'classics', 'canonical'],
  'Literary Fiction': ['literary fiction', 'literary', 'drama'],
  
  # Moods
  'Cozy': ['cozy', 'warm', 'gentle', 'comforting'],
  'Dark & Gritty': ['dark', 'gritty', 'noir', 'bleak', 'grim', 'somber'],
  'Melancholic': ['melancholic', 'sad', 'mournful', 'wistful', 'sombre', 'depressing'],
  'Uplifting': ['uplifting', 'inspiring', 'hopeful', 'cheerful', 'optimistic'],
  'Tense & Thrilling': ['tense', 'thrilling', 'action-packed', 'nail-biting', 'suspenseful'],
  'Whimsical': ['whimsical', 'playful', 'magical', 'quirky', 'fanciful'],
  'Thought-Provoking': ['thought-provoking', 'intellectual', 'deep', 'philosophical', 'existential'],
  'Heartwarming': ['heartwarming', 'sweet', 'tender', 'charming'],
  'Chilling': ['chilling', 'creepy', 'spooky', 'terrifying', 'frightening'],
  'Adventurous': ['adventurous', 'adventure', 'quest', 'journey', 'exploration'],
  'Romantic': ['romantic', 'romance', 'passionate'],
  'Funny & Witty': ['funny', 'witty', 'humorous', 'comedy', 'satire', 'ironic'],
  'Emotionally Heavy': ['emotionally heavy', 'tragic', 'devastating', 'intense drama', 'grief'],
  'Light & Breezy': ['light', 'breezy', 'fun', 'easy reading', 'comfort'],
  'Nostalgic': ['nostalgic', 'retro', 'childhood memories', 'yearning'],

  # Pace
  'Slow Burn': ['slow burn', 'slow-paced', 'leisurely', 'character-driven'],
  'Fast-Paced': ['fast-paced', 'thrilling', 'gripping', 'unputdownable'],
  'Balanced': ['balanced pace', 'steady pace', 'well-paced'],
  'Episodic': ['episodic', 'picaresque', 'vignettes'],

  # Settings
  'Contemporary': ['contemporary setting', 'modern day', 'present day'],
  'Historical': ['historical setting', 'victorian', 'medieval', 'ancient', 'world war'],
  'Futuristic': ['futuristic setting', 'future', 'space', 'advanced technology'],
  'Fantasy World': ['fantasy world', 'magic realm', 'middle earth', 'imaginary world'],
  'Rural': ['rural', 'countryside', 'village', 'wilderness', 'forest'],
  'Urban': ['urban', 'city', 'metropolis', 'downtown'],
  'Space': ['space', 'galaxy', 'interstellar', 'spaceship'],
  'Ocean': ['ocean', 'sea', 'maritime', 'nautical', 'underwater'],
  'Post-Apocalyptic': ['post-apocalyptic', 'apocalypse', 'dystopian', 'ruined world'],
  'Alternate History': ['alternate history', 'what if'],
  'Mythological': ['mythological', 'mythology', 'gods', 'legends'],

  # Themes
  'Coming of Age': ['coming of age', 'growing up', 'adolescence', 'school days'],
  'Identity & Self-Discovery': ['identity', 'self-discovery', 'who am i', 'finding oneself'],
  'Power & Politics': ['power', 'politics', 'government', 'conspiracy', 'empire', 'rebellion'],
  'Survival': ['survival', 'surviving', 'wilderness survival', 'disaster'],
  'Love & Relationships': ['love', 'relationships', 'romance', 'marriage', 'affair'],
  'Family Dynamics': ['family', 'parents', 'siblings', 'inheritance'],
  'Friendship': ['friendship', 'friends', 'companionship'],
  'Grief & Loss': ['grief', 'loss', 'death', 'mourning'],
  'Morality & Ethics': ['morality', 'ethics', 'good and evil', 'moral dilemma'],
  'Nature & Environment': ['nature', 'environment', 'animals', 'climate change'],
  'War & Conflict': ['war', 'battle', 'military', 'soldier', 'combat'],
  'Technology & Society': ['technology', 'social media', 'robots', 'ai'],
  'Religion & Faith': ['religion', 'faith', 'church', 'spirituality', 'god'],
  'Class & Inequality': ['class', 'inequality', 'poverty', 'wealth', 'social division'],
  'Mental Health': ['mental health', 'depression', 'anxiety', 'madness', 'psychology'],
  'Art & Creativity': ['art', 'writing', 'music', 'painting', 'creativity'],
  'Crime & Justice': ['crime', 'justice', 'murder', 'law', 'detective', 'prison'],
  'Redemption': ['redemption', 'forgiveness', 'saving grace', 'second chance']
}

def download_data():
  print("Downloading CMU Book Summary Dataset...")
  data_dir = "data"
  os.makedirs(data_dir, exist_ok=True)
  
  cmu_tar_path = os.path.join(data_dir, "booksummaries.tar.gz")
  if not os.path.exists(cmu_tar_path):
    url = "http://www.cs.cmu.edu/~dbgroup/linking_mods/data/booksummaries.tar.gz"
    urllib.request.urlretrieve(url, cmu_tar_path)
    print("Download finished. Extracting...")
    
  with tarfile.open(cmu_tar_path, "r:gz") as tar:
    tar.extractall(path=data_dir)
  print("CMU dataset ready.")

def fetch_openlibrary_sample():
  print("Acquiring Open Library sample data...")
  os.makedirs("data", exist_ok=True)
  ol_path = os.path.join("data", "openlibrary_sample.json")
  if os.path.exists(ol_path):
    print("Open Library sample already exists locally.")
    with open(ol_path, 'r', encoding='utf-8') as f:
      return json.load(f)

  sample_genres = [
    'science_fiction', 'fantasy', 'horror', 'thriller', 'mystery', 'romance',
    'historical_fiction', 'biography', 'poetry', 'classics', 'philosophy', 'history'
  ]
  books = []
  
  for genre in sample_genres:
    print(f"Fetching books for genre: {genre}...")
    url = f"https://openlibrary.org/search.json?q=subject:{genre}&limit=100"
    try:
      r = requests.get(url, timeout=15)
      if r.status_code == 200:
        data = r.json()
        docs = data.get('docs', [])
        for doc in docs:
          title = doc.get('title', '')
          subjects = doc.get('subject', [])
          # Search endpoint does not have synopsis, so we mock/approximate description
          # or try to get descriptions if we can, but since search doesn't return descriptions,
          # we construct a text string using title + subjects.
          # To make training robust, we will rely on subjects heavily.
          desc = f"Title: {title}. Subjects: {', '.join(subjects)}"
          books.append({
            'title': title,
            'description': desc,
            'subjects': subjects
          })
    except Exception as e:
      print(f"Failed to fetch {genre}: {e}")
      
  with open(ol_path, 'w', encoding='utf-8') as f:
    json.dump(books, f, ensure_ascii=False, indent=2)
    
  return books

def map_cmu_to_taxonomy():
  print("Processing and mapping CMU dataset...")
  cmu_file = "data/booksummaries/booksummaries.txt"
  
  columns = ['wikiId', 'freebaseId', 'title', 'author', 'pubDate', 'genres', 'summary']
  df = pd.read_csv(cmu_file, sep='\t', names=columns, header=None)
  
  mapped_data = []
  
  for idx, row in df.iterrows():
    summary = str(row['summary'])
    title = str(row['title'])
    
    # Extract raw genre list from freebase JSON string
    raw_genres = []
    genre_str = row['genres']
    if pd.notna(genre_str):
      try:
        genre_dict = json.loads(genre_str)
        raw_genres = list(genre_dict.values())
      except:
        pass
        
    text = f"{title} {summary} " + " ".join(raw_genres)
    text_lower = text.lower()
    
    # Map raw labels
    mapped_labels = []
    
    # Rule map using labels
    for tag, keywords in LABEL_MAP.items():
      # check if text matches keywords
      matched = False
      for kw in keywords:
        if kw in text_lower:
          matched = True
          break
      if matched:
        mapped_labels.append(tag)
        
    # Always include at least one genre tag fallback based on rule-based defaults
    if not any(g in mapped_labels for g in TAXONOMY['genre']):
      # Check original genres for matching
      for rg in raw_genres:
        rg_l = rg.lower()
        if 'scifi' in rg_l or 'science fiction' in rg_l:
          mapped_labels.append('Science Fiction')
        elif 'fantasy' in rg_l:
          mapped_labels.append('Fantasy')
        elif 'history' in rg_l or 'historical' in rg_l:
          mapped_labels.append('Historical Fiction')
        elif 'poetry' in rg_l:
          mapped_labels.append('Poetry')
        elif 'biograph' in rg_l:
          mapped_labels.append('Biography')
      
      # If still nothing, assign 'Literary Fiction' as default
      if not any(g in mapped_labels for g in TAXONOMY['genre']):
        mapped_labels.append('Literary Fiction')
        
    mapped_data.append({
      'text': summary + " " + " ".join(raw_genres),
      'labels': mapped_labels
    })
    
  return mapped_data

def train_model():
  download_data()
  ol_books = fetch_openlibrary_sample()
  cmu_mapped = map_cmu_to_taxonomy()
  
  # Combine data
  texts = []
  label_lists = []
  
  # Process CMU
  for item in cmu_mapped:
    texts.append(item['text'])
    label_lists.append(item['labels'])
    
  # Process Open Library Sample
  for item in ol_books:
    text = f"{item['title']} {item['description']} " + " ".join(item['subjects'])
    # Map open library subjects
    mapped_labels = []
    text_lower = text.lower()
    for tag, keywords in LABEL_MAP.items():
      for kw in keywords:
        if kw in text_lower:
          mapped_labels.append(tag)
          break
          
    if not any(g in mapped_labels for g in TAXONOMY['genre']):
      mapped_labels.append('Literary Fiction')
      
    texts.append(text)
    label_lists.append(mapped_labels)
    
  print(f"Total compiled dataset size: {len(texts)} samples.")
  
  # Vectorizer
  print("Vectorizing text inputs...")
  vectorizer = TfidfVectorizer(
    max_features=8000,
    ngram_range=(1, 2),
    sublinear_tf=True,
    stop_words='english'
  )
  X = vectorizer.fit_transform(texts).toarray().astype('float32')
  
  # Fit labels MultiLabelBinarizer
  mlb = MultiLabelBinarizer(classes=ALL_TAGS)
  y = mlb.fit_transform(label_lists).astype('float32')
  
  # Train/val split (80/20)
  indices = np.arange(X.shape[0])
  np.random.shuffle(indices)
  split = int(X.shape[0] * 0.8)
  
  train_idx, val_idx = indices[:split], indices[split:]
  X_train, X_val = X[train_idx], X[val_idx]
  y_train, y_val = y[train_idx], y[val_idx]
  
  print("Building Neural Network MLP...")
  inputs = keras.Input(shape=(8000,))
  x = keras.layers.Dense(512, activation='relu')(inputs)
  x = keras.layers.Dropout(0.3)(x)
  x = keras.layers.Dense(256, activation='relu')(x)
  x = keras.layers.Dropout(0.3)(x)
  outputs = keras.layers.Dense(len(ALL_TAGS), activation='sigmoid')(x)
  
  model = keras.Model(inputs, outputs)
  model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['binary_accuracy']
  )
  
  print("Training model...")
  early_stop = keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True)
  
  model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=12,
    batch_size=64,
    callbacks=[early_stop]
  )
  
  # Compute classification F1 thresholds on validation set
  print("Tuning classification thresholds on validation set...")
  preds = model.predict(X_val)
  thresholds = {}
  
  for idx, tag in enumerate(ALL_TAGS):
    best_t = 0.5
    best_f1 = 0.0
    for t in np.arange(0.1, 0.9, 0.05):
      tag_preds = (preds[:, idx] >= t).astype(int)
      score = f1_score(y_val[:, idx], tag_preds, zero_division=0)
      if score > best_f1:
        best_f1 = score
        best_t = float(t)
    thresholds[tag] = best_t
    
  # Compute overall validation F1 score
  final_preds = np.zeros_like(preds)
  for idx, tag in enumerate(ALL_TAGS):
    final_preds[:, idx] = (preds[:, idx] >= thresholds[tag]).astype(int)
  
  overall_f1 = f1_score(y_val, final_preds, average='micro')
  print(f"Overall validation micro-F1 score: {overall_f1:.4f}")
  
  # Export files to app directory
  print("Exporting model vocabulary, thresholds and network outputs...")
  output_dir = "../public/models/tagger"
  os.makedirs(output_dir, exist_ok=True)
  
  # Save thresholds
  with open(os.path.join(output_dir, "../thresholds.json"), "w") as f:
    json.dump(thresholds, f, indent=2)
    
  # Save vocab mapping
  vocab_mapping = {term: int(idx) for term, idx in vectorizer.vocabulary_.items()}
  with open(os.path.join(output_dir, "../vocab.json"), "w") as f:
    json.dump(vocab_mapping, f, indent=2)
    
  # Save IDF weights so browser can replicate TF-IDF scaling exactly
  idf_weights = {term: float(vectorizer.idf_[idx]) for term, idx in vectorizer.vocabulary_.items()}
  with open(os.path.join(output_dir, "../idf.json"), "w") as f:
    json.dump(idf_weights, f, indent=2)
    
  # Save Keras Model
  keras_model_path = "models/shelf_tagger"
  os.makedirs("models", exist_ok=True)
  model.save(keras_model_path)
  
  # Convert Keras model to TFJS format
  print("Converting to quantized TF.js Graph Model...")
  os.system(f"tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model --quantize_uint8 models/shelf_tagger ../public/models/tagger")
  
  # Output training metrics
  os.makedirs("data", exist_ok=True)
  with open("results.json", "w") as f:
    json.dump({"micro_f1": float(overall_f1)}, f)
    
  print("ML Model pipeline execution completed successfully!")

if __name__ == "__main__":
  train_model()

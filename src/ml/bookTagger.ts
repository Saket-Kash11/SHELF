import * as tf from '@tensorflow/tfjs';
import { TAXONOMY } from './taxonomy';
import { ruleTagBook } from './ruleTagger';

export interface TagResult {
  mood: string[];
  pace: string[];
  setting: string[];
  theme: string[];
  genre: string[];
  confidence: Record<string, number>;
}

export class BookTagger {
  private model: tf.GraphModel | null = null;
  private vocab: Record<string, number> = {};
  private thresholds: Record<string, number> = {};
  private idfWeights: Record<string, number> = {};
  private isLoaded = false;

  async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      
      // Load vocabulary
      const vocabRes = await fetch(`${baseUrl}models/vocab.json`);
      if (!vocabRes.ok) throw new Error('Vocabulary json missing');
      this.vocab = await vocabRes.json();

      // Load thresholds
      const thresholdsRes = await fetch(`${baseUrl}models/thresholds.json`);
      if (!thresholdsRes.ok) throw new Error('Thresholds json missing');
      this.thresholds = await thresholdsRes.json();

      // Load idf weights
      const idfRes = await fetch(`${baseUrl}models/idf.json`);
      if (!idfRes.ok) throw new Error('IDF weights json missing');
      this.idfWeights = await idfRes.json();

      // Load TF.js model
      this.model = await tf.loadGraphModel(`${baseUrl}models/tagger/model.json`);
      
      this.isLoaded = true;
      console.log('TF.js Book Tagger loaded successfully.');
    } catch (err) {
      console.warn('TF.js Model loading failed. Falling back to rule-based tagger. Details:', err);
      throw err;
    }
  }

  async tag(description: string, subjects: string[]): Promise<TagResult> {
    try {
      // 1. Try to load the model assets
      await this.load();

      if (!this.model) {
        throw new Error('Model is not initialized.');
      }

      // 2. Preprocess text
      const cleanDesc = description || '';
      const cleanSubjects = subjects || [];
      const textToClassify = `${cleanDesc} ${cleanSubjects.join(' ')}`;

      // 3. Vectorize
      const tfidfVector = this.tfidfVectorize(textToClassify);

      // 4. Run prediction
      const inputTensor = tf.tensor2d([Array.from(tfidfVector)], [1, tfidfVector.length]);
      const predictionTensor = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await predictionTensor.data();

      // Cleanup tensors
      inputTensor.dispose();
      predictionTensor.dispose();

      // 5. Apply thresholds
      const result: TagResult = {
        mood: [],
        pace: [],
        setting: [],
        theme: [],
        genre: [],
        confidence: {}
      };

      const categories = Object.keys(TAXONOMY) as Array<keyof typeof TAXONOMY>;
      const allTags = [
        ...TAXONOMY.mood,
        ...TAXONOMY.pace,
        ...TAXONOMY.setting,
        ...TAXONOMY.theme,
        ...TAXONOMY.genre
      ];

      allTags.forEach((tag, idx) => {
        const prob = probabilities[idx];
        const threshold = this.thresholds[tag] || 0.5;

        if (prob >= threshold) {
          // Find which category this tag belongs to
          for (const cat of categories) {
            if ((TAXONOMY[cat] as readonly string[]).includes(tag)) {
              result[cat].push(tag);
              result.confidence[tag] = parseFloat(prob.toFixed(2));
              break;
            }
          }
        }
      });

      // Enforce at least one genre tag
      if (result.genre.length === 0) {
        result.genre.push('Literary Fiction');
        result.confidence['Literary Fiction'] = 0.50;
      }

      // Limit tags per category to keep UI readable
      for (const cat of categories) {
        result[cat].sort((a, b) => (result.confidence[b] || 0) - (result.confidence[a] || 0));
        result[cat] = result[cat].slice(0, 5);
      }

      return result;
    } catch (err) {
      console.warn('Error during in-browser ML inference, using keyword rules instead:', err);
      // Revert to pure rules
      return ruleTagBook(description, subjects);
    }
  }

  private tfidfVectorize(text: string): Float32Array {
    const tokens = this.tokenize(text);
    const tfMap: Record<string, number> = {};

    tokens.forEach((token) => {
      if (this.vocab[token] !== undefined) {
        tfMap[token] = (tfMap[token] || 0) + 1;
      }
    });

    const vector = new Float32Array(Object.keys(this.vocab).length);
    let sumSquares = 0;

    for (const token in tfMap) {
      const idx = this.vocab[token];
      const tfVal = tfMap[token];
      const sublinearTf = 1 + Math.log(tfVal);
      const idf = this.idfWeights[token] || 1;
      const tfidf = sublinearTf * idf;
      vector[idx] = tfidf;
      sumSquares += tfidf * tfidf;
    }

    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  private tokenize(text: string): string[] {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const rawWords = cleaned.split(/\s+/).filter(w => w.length >= 2);
    
    // Standard sklearn English stop words
    const stopWords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
      'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
      'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from',
      'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here',
      'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'im', 'ive', 'if', 'in', 'into',
      'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
      'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
      'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats', 'the',
      'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre',
      'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed',
      'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who',
      'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
      'your', 'yours', 'yourself', 'yourselves'
    ]);
    
    const words = rawWords.filter(w => !stopWords.has(w));
    
    // Construct unigrams and bigrams
    const ngrams: string[] = [...words];
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.push(`${words[i]} ${words[i+1]}`);
    }
    
    return ngrams;
  }
}

export const bookTagger = new BookTagger();

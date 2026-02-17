import faiss
import numpy as np
import pickle
import os
from .embedding_utils import generate_embeddings, get_dimension

class FAISSDatabase:
    def __init__(self, index_path="vector_store.index", doc_map_path="doc_map.pkl"):
        self.dimension = get_dimension()
        self.index_path = index_path
        self.doc_map_path = doc_map_path
        self.index = None
        self.doc_map = {}  # int_id -> document dict
        self._load()

    def _load(self):
        if os.path.exists(self.index_path) and os.path.exists(self.doc_map_path):
            print(f"[VectorStore] Loading index from {self.index_path}")
            self.index = faiss.read_index(self.index_path)
            with open(self.doc_map_path, 'rb') as f:
                self.doc_map = pickle.load(f)
        else:
            print("[VectorStore] Creating new index")
            self.index = faiss.IndexFlatL2(self.dimension)
            self.doc_map = {}

    def save(self):
        faiss.write_index(self.index, self.index_path)
        with open(self.doc_map_path, 'wb') as f:
            pickle.dump(self.doc_map, f)
        print(f"[VectorStore] Index saved with {self.index.ntotal} vectors")

    def add_documents(self, documents: list):
        """
        documents: List of dicts with 'text', 'id' (optional), 'metadata' (optional)
        """
        if not documents:
            return

        texts = [doc['text'] for doc in documents]
        embeddings = generate_embeddings(texts).astype('float32')
        
        start_id = len(self.doc_map)
        self.index.add(embeddings)
        
        for i, doc in enumerate(documents):
            internal_id = start_id + i
            self.doc_map[internal_id] = doc
            
        self.save()

    def search(self, query_text: str, k=5):
        if self.index.ntotal == 0:
            return []

        query_vector = generate_embeddings([query_text]).astype('float32')
        distances, indices = self.index.search(query_vector, k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx in self.doc_map:
                doc = self.doc_map[idx]
                results.append({
                    "document": doc,
                    "score": 1 / (1 + distances[0][i])  # approximate similarity score
                })
        return results

    def clear(self):
        self.index = faiss.IndexFlatL2(self.dimension)
        self.doc_map = {}
        self.save()

# Global instance
vector_db = FAISSDatabase()
